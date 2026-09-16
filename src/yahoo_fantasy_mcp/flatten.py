"""Normalize Yahoo's mechanically translated XML-as-JSON responses."""

from __future__ import annotations

from typing import Any


def _unwrap_same_key(items: list[Any]) -> list[Any]:
    """Apply R3 to a list after its elements have been flattened."""
    if items and all(isinstance(item, dict) and len(item) == 1 for item in items):
        keys = [next(iter(item)) for item in items]
        if len(set(keys)) == 1:
            return [item[keys[0]] for item in items]
    return items


def flatten(obj: Any) -> Any:
    """Recursively flatten Yahoo Fantasy's JSON representation."""
    if isinstance(obj, dict):
        keys = set(obj)
        numeric_keys = [key for key in keys if isinstance(key, str) and key.isdigit()]
        if keys and keys <= set(numeric_keys) | {"count"}:
            items = [flatten(obj[key]) for key in sorted(numeric_keys, key=int)]
            return _unwrap_same_key(items)
        return {key: flatten(value) for key, value in obj.items()}

    if isinstance(obj, list):
        items = [flatten(item) for item in obj]
        items = [item for item in items if item not in ([], {}, "", None)]
        if items and all(isinstance(item, dict) for item in items):
            seen: set[Any] = set()
            disjoint = True
            for item in items:
                if seen & set(item):
                    disjoint = False
                    break
                seen.update(item)
            if disjoint:
                merged: dict[str, Any] = {}
                for item in items:
                    merged.update(item)
                return merged
        # One manager is merged by R2, while repeated manager keys collide and
        # are unwrapped here by R3. This known asymmetry matches Yahoo's shape.
        return _unwrap_same_key(items)

    return obj
