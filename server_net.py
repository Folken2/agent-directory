"""Listening-socket helpers for the ADK server."""

import socket


def dual_stack_socket(port: int) -> socket.socket:
    """Bind [::]:port with IPV6_V6ONLY off so IPv4 and IPv6 clients both connect.

    uvicorn's own host="::" bind leaves IPV6_V6ONLY on (IPv6 only), which
    refuses 127.0.0.1 and IPv4-only proxies.
    """
    sock = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
    try:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        sock.bind(("::", port))
    except BaseException:
        sock.close()
        raise
    return sock
