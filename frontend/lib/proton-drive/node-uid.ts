/** Split a Proton Drive node UID (`volumeId~nodeId`) into storage reference parts. */
export function splitNodeUid(nodeUid: string): { shareId: string; nodeId: string } {
  const parts = nodeUid.split('~');
  if (parts.length !== 2) {
    throw new Error(`Invalid Proton node UID: ${nodeUid}`);
  }
  const [shareId, nodeId] = parts;
  return { shareId, nodeId };
}
