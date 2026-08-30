import { spawn } from "child_process";

/**
 * Force-removes a Docker container by name.
 *
 * Called in finally blocks after every execution to guarantee cleanup,
 * even if --rm raced or the container is stuck.
 *
 * Uses `docker rm -f` which sends SIGKILL if the container is still running.
 * Silently ignores errors if the container doesn't exist.
 */
export async function ensureContainerRemoved(
  containerName: string,
): Promise<void> {
  return new Promise((resolve) => {
    const proc = spawn("docker", ["rm", "-f", containerName], {
      stdio: "ignore",
      // shell: false — containerName comes from our own UUID generator, but
      // we still avoid shell mode as a defense-in-depth measure
    });
    proc.on("close", () => resolve());
    proc.on("error", () => resolve()); // ignore ENOENT if docker is unavailable
  });
}
