FROM gcc:13-bookworm

# Create non-root sandbox user (UID 1001)
RUN useradd -m -u 1001 -s /bin/false sandbox

# GCC 13 (g++) is the only toolchain required
# No network utilities, no shell utilities beyond /bin/sh

USER sandbox
WORKDIR /sandbox
