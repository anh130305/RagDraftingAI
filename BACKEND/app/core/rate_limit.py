import os
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Initialize limiter — uses remote IP by default (avoid Testing Environment)
is_testing = os.getenv("DATABASE_URL", "").endswith("test.db")
limiter = Limiter(key_func=get_remote_address, enabled=not is_testing)

def init_rate_limiting(app):
    """Register rate limiting middleware and exception handlers."""
    if not is_testing:
        app.state.limiter = limiter
        app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
