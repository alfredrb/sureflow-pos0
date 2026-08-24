// Packages the relay repo as a .tar.gz the admin extracts into a git checkout and
// pushes. Built in the browser from the app's own module strings, so the archive can
// never drift from the app that produced it.

import { buildTarGz, downloadBlob } from "@/lib/tarWriter";
import { buildRepoFiles } from "@/lib/relayRepoFiles";
import { REPO_NAME } from "@/lib/relayRepoConfig";

/** Builds the archive and returns { blob, filename, fileCount }. */
export async function buildRelayRepoTarball(tag) {
  const files = buildRepoFiles();
  // Flat archive: the files land at the ROOT of the repo checkout, so extracting over
  // an existing clone updates it in place rather than nesting a directory.
  const blob = await buildTarGz(files);
  const suffix = tag ? `-${tag}` : "";
  return { blob, filename: `${REPO_NAME}${suffix}.tar.gz`, fileCount: files.length };
}

export async function downloadRelayRepoTarball(tag) {
  const { blob, filename, fileCount } = await buildRelayRepoTarball(tag);
  downloadBlob(blob, filename);
  return { filename, fileCount };
}