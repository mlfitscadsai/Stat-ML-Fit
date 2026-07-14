"""
Class-balance preprocessing for HPC / backend training scripts.

Mirrors the frontend class-balance-service semantics so remote jobs can
apply the same merge/remove rules without data leakage.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import cmp_to_key
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple


DEFAULT_OPTIONS = {
    "underrepresented_threshold": 0.05,
    "minimum_class_share": 0.15,
    "max_removal_fraction": 0.10,
    "strategy": "auto",
    "min_classes": 2,
}


def _normalize_label(value: Any) -> str:
    return str(value).strip()


def count_classes(values: Sequence[Any]) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for value in values:
        if value is None or value == "":
            continue
        key = _normalize_label(value)
        counts[key] = counts.get(key, 0) + 1
    return counts


def distribution_from_counts(counts: Mapping[str, int]) -> Dict[str, Any]:
    total = sum(counts.values())
    distribution = sorted(
        (
            {"label": label, "count": count, "share": (count / total) if total else 0.0}
            for label, count in counts.items()
        ),
        key=lambda item: item["label"],
    )
    return {"total": total, "distribution": distribution}


def detect_ordinal_labels(labels: Iterable[str]) -> bool:
    labels = list(labels)
    if not labels:
        return False
    for label in labels:
        try:
            parsed = float(label)
        except ValueError:
            return False
        if str(int(parsed)) != label.strip() and str(parsed) != label.strip():
            return False
    return True


def _compare_labels(a: str, b: str) -> int:
    try:
        return (float(a) > float(b)) - (float(a) < float(b))
    except ValueError:
        return (a > b) - (a < b)


@dataclass
class ClassGroup:
    members: List[str]
    count: int
    name: str
    is_ordinal: bool


def _create_group_name(members: Sequence[str], is_ordinal: bool) -> str:
    sorted_members = sorted(members, key=cmp_to_key(_compare_labels))
    return "_".join(sorted_members) if is_ordinal else "_plus_".join(sorted_members)


def plan_class_balance(target_values: Sequence[Any], options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    config = {**DEFAULT_OPTIONS, **(options or {})}
    original_counts = count_classes(target_values)
    original = distribution_from_counts(original_counts)

    if len(original["distribution"]) <= 1:
        return {
            "strategy": "none",
            "label_map": {label: label for label in original_counts},
            "removed_labels": [],
            "merge_groups": [],
            "original": original,
            "final": original,
            "removed_count": 0,
            "removed_fraction": 0.0,
            "is_ordinal": detect_ordinal_labels(original_counts.keys()),
            "log": ["Skipped class balancing: fewer than two classes present."],
            "passed_validation": True,
        }

    is_ordinal = detect_ordinal_labels(original_counts.keys())
    total_rows = original["total"]
    max_removable = int(total_rows * config["max_removal_fraction"])
    merge_groups: List[Dict[str, Any]] = []
    log: List[str] = []
    removed_original_labels: set[str] = set()
    removed_count = 0

    allow_merge = config["strategy"] in {"merge", "merge_then_remove", "auto"}
    allow_remove = config["strategy"] in {"remove", "merge_then_remove", "auto"}

    groups = [
        ClassGroup(members=[label], count=count, name=label, is_ordinal=is_ordinal)
        for label, count in original_counts.items()
    ]

    def _distribution() -> Dict[str, Any]:
        active_total = total_rows - removed_count
        return {
            "total": active_total,
            "distribution": [
                {
                    "label": group.name,
                    "count": group.count,
                    "share": (group.count / active_total) if active_total else 0.0,
                }
                for group in sorted(groups, key=lambda item: item.name)
            ],
        }

    def _ordinal_neighbor(group: ClassGroup) -> Optional[ClassGroup]:
        values = [float(member) for member in group.members]
        min_value = min(values)
        max_value = max(values)
        best = None
        best_distance = float("inf")
        for candidate in groups:
            if candidate is group:
                continue
            candidate_min = min(float(member) for member in candidate.members)
            candidate_max = max(float(member) for member in candidate.members)
            distance = min(abs(candidate_min - max_value), abs(candidate_max - min_value))
            if distance < best_distance:
                best_distance = distance
                best = candidate
        return best

    def _categorical_neighbor(group: ClassGroup) -> Optional[ClassGroup]:
        best = None
        best_count = -1
        for candidate in groups:
            if candidate is group:
                continue
            if candidate.count > best_count:
                best_count = candidate.count
                best = candidate
        return best

    def _merge_with_neighbor(group: ClassGroup, reason_prefix: str) -> bool:
        neighbor = _ordinal_neighbor(group) if is_ordinal else _categorical_neighbor(group)
        if neighbor is None or neighbor is group:
            return False
        neighbor.members = sorted(set(neighbor.members + group.members), key=cmp_to_key(_compare_labels))
        neighbor.count += group.count
        neighbor.name = _create_group_name(neighbor.members, is_ordinal)
        merge_groups.append(
            {
                "merged_labels": list(group.members),
                "new_label": neighbor.name,
                "reason": (
                    f"{reason_prefix}: merged [{', '.join(group.members)}] "
                    f"into [{', '.join(neighbor.members)}] → '{neighbor.name}'"
                ),
            }
        )
        log.append(merge_groups[-1]["reason"])
        groups.remove(group)
        return True

    def _remove_group(group: ClassGroup, reason: str) -> bool:
        nonlocal removed_count
        if not allow_remove:
            return False
        if removed_count + group.count > max_removable:
            log.append(
                f"Removal blocked for '{group.name}': would exceed "
                f"{config['max_removal_fraction'] * 100:.0f}% cap."
            )
            return False
        if len(groups) - 1 < config["min_classes"]:
            log.append(
                f"Removal blocked for '{group.name}': would leave fewer than "
                f"{config['min_classes']} classes."
            )
            return False
        removed_original_labels.update(group.members)
        removed_count += group.count
        groups.remove(group)
        log.append(
            f"Removed class group '{group.name}' ({group.count} samples, "
            f"{(group.count / total_rows) * 100:.2f}%): {reason}"
        )
        return True

    if allow_merge:
        for _ in range(100):
            current = _distribution()["distribution"]
            under = [entry for entry in current if entry["share"] < config["underrepresented_threshold"]]
            if not under:
                break
            target = sorted(under, key=lambda item: item["share"])[0]
            group = next((item for item in groups if item.name == target["label"]), None)
            if group is None:
                break
            if not _merge_with_neighbor(group, "Underrepresented class merge"):
                break

    for _ in range(100):
        current = _distribution()["distribution"]
        below_min = [entry for entry in current if entry["share"] < config["minimum_class_share"]]
        if not below_min:
            break
        target = sorted(below_min, key=lambda item: item["share"])[0]
        group = next((item for item in groups if item.name == target["label"]), None)
        if group is None:
            break
        if allow_merge and len(groups) > config["min_classes"]:
            if _merge_with_neighbor(group, "Minimum share enforcement"):
                continue
        if allow_remove:
            if _remove_group(
                group,
                f"share {target['share'] * 100:.2f}% below "
                f"{config['minimum_class_share'] * 100:.0f}% minimum",
            ):
                continue
        break

    label_map: Dict[str, Optional[str]] = {}
    for group in groups:
        for member in group.members:
            label_map[member] = group.name
    for removed in removed_original_labels:
        label_map[removed] = None

    final = _distribution()
    passed_validation = (
        all(entry["share"] >= config["minimum_class_share"] for entry in final["distribution"])
        and removed_count <= max_removable
        and len(final["distribution"]) >= config["min_classes"]
    )

    if not passed_validation:
        offenders = [
            f"{entry['label']} ({entry['share'] * 100:.2f}%)"
            for entry in final["distribution"]
            if entry["share"] < config["minimum_class_share"]
        ]
        if offenders:
            log.append(f"Validation warning: classes below minimum share remain: {', '.join(offenders)}")
    else:
        log.append("Class balance validation passed.")

    return {
        "strategy": config["strategy"],
        "label_map": label_map,
        "removed_labels": sorted(removed_original_labels),
        "merge_groups": merge_groups,
        "original": original,
        "final": final,
        "removed_count": removed_count,
        "removed_fraction": (removed_count / total_rows) if total_rows else 0.0,
        "is_ordinal": is_ordinal,
        "log": log,
        "passed_validation": passed_validation,
    }


def apply_class_balance_to_values(
    target_values: Sequence[Any], plan: Mapping[str, Any]
) -> Tuple[List[str], List[int]]:
    kept_indices: List[int] = []
    values: List[str] = []
    label_map = plan["label_map"]
    removed_labels = set(plan["removed_labels"])

    for index, value in enumerate(target_values):
        if value is None or value == "":
            continue
        label = _normalize_label(value)
        mapped = label_map.get(label, label)
        if mapped is None or label in removed_labels:
            continue
        kept_indices.append(index)
        values.append(mapped)
    return values, kept_indices


def validate_class_balance(plan: Mapping[str, Any], options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    config = {**DEFAULT_OPTIONS, **(options or {})}
    issues: List[str] = []

    if plan["removed_fraction"] > config["max_removal_fraction"]:
        issues.append(
            f"Removed {plan['removed_fraction'] * 100:.2f}% of rows "
            f"(limit {config['max_removal_fraction'] * 100:.0f}%)."
        )
    if len(plan["final"]["distribution"]) < config["min_classes"]:
        issues.append(f"Only {len(plan['final']['distribution'])} class(es) remain after balancing.")
    for entry in plan["final"]["distribution"]:
        if entry["share"] < config["minimum_class_share"]:
            issues.append(
                f"Class '{entry['label']}' is {entry['share'] * 100:.2f}% "
                f"(minimum {config['minimum_class_share'] * 100:.0f}%)."
            )
    if len(plan["final"]["distribution"]) < 2:
        issues.append("Insufficient classes for classification after balancing.")

    return {"ok": not issues, "issues": issues}
