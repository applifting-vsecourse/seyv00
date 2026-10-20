import { api } from "@/lib/api-client"

// The server deletes only the caller's own quacks; anyone else's is a 403.
export async function deleteQuack(quackId: string): Promise<void> {
  await api.delete(`quacks/${quackId}`)
}
