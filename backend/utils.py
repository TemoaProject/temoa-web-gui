import ssl
import certifi
import os
import logging

logger = logging.getLogger(__name__)


def create_secure_ssl_context():
    """
    Creates a secure SSL context using certifi's CA bundle.
    Allows bypassing verification ONLY if TEMOA_SKIP_CERT_VERIFY is set to '1'.
    """
    skip_verify = os.environ.get("TEMOA_SKIP_CERT_VERIFY") == "1"

    if skip_verify:
        logger.warning(
            "SSL certificate verification is DISABLED via TEMOA_SKIP_CERT_VERIFY."
        )
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx

    # Secure default using certifi
    ctx = ssl.create_default_context(cafile=certifi.where())
    return ctx
