import json
import hashlib
import copy

class NodeCache:
    """Cache for node inputs and outputs to avoid redundant computation."""
    def __init__(self):
        # node_id -> {"input_hash": ..., "output": ...}
        self.cache = {}

    def get_cache(self, node_id, input_obj):
        return None
        input_hash = self._hash_inputs(input_obj)
        entry = self.cache.get(node_id)
        if entry and entry["input_hash"] == input_hash:
            return entry["output"]
        return None

    def set_cache(self, node_id, input_obj, output):
        input_hash = self._hash_inputs(input_obj)
        self.cache[node_id] = {"input_hash": input_hash, "output": copy.deepcopy(output)}

    def _hash_inputs(self, input_obj):
        # Normalize and hash the input for comparison
        try:
            norm = self._normalize(input_obj)
            # Use json for stable serialization
            norm_str = json.dumps(norm, sort_keys=True, default=self._custom_serializer)
            return hashlib.sha256(norm_str.encode("utf-8")).hexdigest()
        except Exception as e:
            # Fallback: use str()
            return hashlib.sha256(str(input_obj).encode("utf-8")).hexdigest()

    def _normalize(self, obj):
        # Recursively normalize input for hashing
        if hasattr(obj, "to_cache_key"):
            return obj.to_cache_key()
        elif hasattr(obj, "to_dict"):
            return obj.to_dict()
        elif isinstance(obj, dict):
            return {k: self._normalize(v) for k, v in obj.items()}
        elif isinstance(obj, (list, tuple)):
            return [self._normalize(v) for v in obj]
        elif isinstance(obj, (str, int, float, bool)) or obj is None:
            return obj
        else:
            # Fallback: try to use __dict__ or str
            return getattr(obj, "__dict__", str(obj))

    def _custom_serializer(self, obj):
        # For json.dumps: try to serialize custom objects
        if hasattr(obj, "to_cache_key"):
            return obj.to_cache_key()
        elif hasattr(obj, "to_dict"):
            return obj.to_dict()
        elif hasattr(obj, "__dict__"):
            return obj.__dict__
        else:
            return str(obj) 