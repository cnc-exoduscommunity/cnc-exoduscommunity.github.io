#!/usr/bin/env python3
"""Ask the Renegade server for its status directly and write it as JSON.

Used by .github/workflows/server-status.yml as a backup for the live status:
some co-op maps (the ones with Nod characters) drop the server from CnCNet's
list even though it is running, but the server still answers this query.

    python3 tools/query_server.py HOST QUERY_PORT OUTPUT.json
"""
import json
import socket
import sys
import time
from datetime import datetime, timezone


def ask(host, port, request, timeout=3.0):
    """Send a GameSpy-style query and collect every reply packet until \\final\\."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(timeout)
    try:
        sock.sendto(request.encode("ascii"), (host, port))
        packets = []
        while True:
            try:
                data, _ = sock.recvfrom(65535)
            except socket.timeout:
                break
            packets.append(data.decode("latin-1"))
            if "\\final\\" in packets[-1]:
                break
        return "".join(packets)
    finally:
        sock.close()


def parse(reply):
    """'\\key\\value\\key\\value' -> {key: value}"""
    parts = reply.split("\\")[1:]
    return {parts[i]: parts[i + 1] for i in range(0, len(parts) - 1, 2)}


def to_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def query(host, port):
    info = {}
    for attempt in range(3):
        info = parse(ask(host, port, "\\status\\"))
        if info.get("hostname"):
            break
        time.sleep(2)
    if not info.get("hostname"):
        return {"online": False}

    players = []
    try:
        p = parse(ask(host, port, "\\players\\"))
        i = 0
        while "player_%d" % i in p:
            players.append({
                "name": p.get("player_%d" % i),
                "team": p.get("team_%d" % i),
                "score": to_int(p.get("score_%d" % i)),
                "ping": to_int(p.get("ping_%d" % i)),
            })
            i += 1
    except OSError:
        pass  # the player list is a bonus; the status above is what matters

    return {
        "online": True,
        "hostname": info.get("hostname"),
        "hostport": info.get("hostport"),
        "mapname": info.get("mapname"),
        "numplayers": to_int(info.get("numplayers")) or 0,
        "maxplayers": to_int(info.get("maxplayers")),
        "timeleft": info.get("timeleft"),
        "players": players,
    }


def main():
    host, port, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
    try:
        status = query(host, port)
    except OSError as e:
        status = {"online": False, "error": str(e)}
    status["checked_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(status, f, ensure_ascii=False, indent=2)
    print(json.dumps(status, ensure_ascii=False))


if __name__ == "__main__":
    main()
