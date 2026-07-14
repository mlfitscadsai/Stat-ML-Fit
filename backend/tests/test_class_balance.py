import pytest

from helpers.class_balance import (
    apply_class_balance_to_values,
    count_classes,
    plan_class_balance,
    validate_class_balance,
)


def test_wine_like_distribution_balances_to_minimum_share():
    qualities = (
        ["3"] * 6
        + ["4"] * 33
        + ["5"] * 483
        + ["6"] * 462
        + ["7"] * 143
        + ["8"] * 16
    )
    plan = plan_class_balance(qualities, {"strategy": "auto"})
    validation = validate_class_balance(plan)

    assert validation["ok"] is True
    assert plan["passed_validation"] is True
    assert plan["removed_fraction"] <= 0.10
    assert all(entry["share"] >= 0.15 for entry in plan["final"]["distribution"])


def test_apply_plan_filters_removed_labels():
    plan = plan_class_balance(["A", "A", "B", "C"], {"strategy": "merge"})
    mapped, kept = apply_class_balance_to_values(["A", "B", "C"], plan)
    assert kept
    assert mapped
