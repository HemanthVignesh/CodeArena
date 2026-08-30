FROM python:3.12-slim

# Create non-root sandbox user (UID 1001)
RUN useradd -m -u 1001 -s /bin/false sandbox

# No extra packages — keep the image minimal
# Python 3.12 interpreter is the only tool available

USER sandbox
WORKDIR /sandbox
