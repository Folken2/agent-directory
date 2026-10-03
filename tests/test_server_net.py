import socket

from server_net import dual_stack_socket


def _connect(family, host, port):
    with socket.socket(family, socket.SOCK_STREAM) as client:
        client.settimeout(2)
        client.connect((host, port))


def test_dual_stack_socket_accepts_ipv4_and_ipv6():
    sock = dual_stack_socket(0)
    try:
        sock.listen(4)
        port = sock.getsockname()[1]
        _connect(socket.AF_INET, "127.0.0.1", port)
        _connect(socket.AF_INET6, "::1", port)
        accepted = []
        for _ in range(2):
            conn, addr = sock.accept()
            accepted.append(addr[0])
            conn.close()
        assert "::ffff:127.0.0.1" in accepted
        assert "::1" in accepted
    finally:
        sock.close()
