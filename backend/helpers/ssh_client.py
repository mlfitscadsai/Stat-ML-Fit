import os
import socket

import paramiko

# Use environment variables (set in docker-compose or .env); fallback to constants if present
try:
    from constants import HPC_HOST, HPC_PASSWORD, HPC_USER
except ImportError:
    HPC_HOST = os.environ.get("HPC_HOST", "")
    HPC_PASSWORD = os.environ.get("HPC_PASSWORD", "")
    HPC_USER = os.environ.get("HPC_USER", "")


class HpcNotConfiguredError(RuntimeError):
    """Raised when HPC SSH settings are missing or invalid."""


def hpc_settings():
    host = (os.environ.get("HPC_HOST") or HPC_HOST or "").strip()
    user = (os.environ.get("HPC_USER") or HPC_USER or "").strip()
    password = os.environ.get("HPC_PASSWORD") or HPC_PASSWORD or ""
    return host, user, password


def hpc_is_configured():
    host, user, password = hpc_settings()
    return bool(host and user and password)


def get_ssh_client():
    host, user, password = hpc_settings()
    if not host or not user or not password:
        raise HpcNotConfiguredError(
            "HPC is not configured. Set HPC_HOST, HPC_USER, and HPC_PASSWORD in /opt/stat-ml-fit/.env "
            "and restart the API container."
        )
    try:
        socket.getaddrinfo(host, 22, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise HpcNotConfiguredError(
            f"HPC_HOST '{host}' is not reachable ({exc}). Fix .env and restart the API container."
        ) from exc

    ssh_client = paramiko.SSHClient()
    ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh_client.connect(
        hostname=host,
        port=22,
        username=user,
        password=password,
        look_for_keys=False,
        timeout=30,
    )
    return ssh_client
