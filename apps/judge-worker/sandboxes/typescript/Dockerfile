FROM node:20-slim

# Install TypeScript compiler at build time — NOT at runtime from user code
RUN npm install -g typescript@5.4.5 --prefer-offline

# Create non-root sandbox user (UID 1001)
RUN useradd -m -u 1001 -s /bin/false sandbox

# tsc is globally installed; node is the runtime
# No npm/npx available to sandbox user at execution time

USER sandbox
WORKDIR /sandbox
