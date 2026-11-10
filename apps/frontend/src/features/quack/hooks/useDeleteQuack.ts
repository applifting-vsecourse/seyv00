import { useMutation, useQueryClient } from "@tanstack/react-query"

import { deleteQuack } from "@/features/quack/api/deleteQuack"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Quack } from "@/features/quack/api/quackSchemas"
import { removeDeletedQuack } from "@/features/quack/api/removeDeletedQuack"

export function useDeleteQuack() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteQuack,
    onSuccess: async (_, quackId) => {
      // Show the result in every cached feed right away, then confirm with the server.
      queryClient.setQueriesData<Quack[]>({ queryKey: quackKeys.lists() }, (quacks) =>
        quacks ? removeDeletedQuack(quacks, quackId) : quacks,
      )
      // feeds, and any open thread (which may now be a placeholder or gone)
      await queryClient.invalidateQueries({ queryKey: quackKeys.all() })
    },
  })
}
