FROM node:22-alpine

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Install useful CLI tools for development
RUN apk add --no-cache git curl bash nano vim

# Create non-root user (required for --dangerously-skip-permissions)
RUN addgroup -S cliuser && adduser -S cliuser -G cliuser

# Set working directory with proper permissions
WORKDIR /workspace
RUN chown -R cliuser:cliuser /workspace

# Switch to non-root user
USER cliuser

# Default: launch Claude Code in safe mode
CMD ["claude", "--dangerously-skip-permissions"]
