import { useMutation, useQueryClient } from "@tanstack/react-query"

import { addReply } from "@/features/quack/api/addReply"
import { quackKeys } from "@/features/quack/api/quackKeys"

export function useAddReply() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: addReply,
    onSuccess: async () => {
      // feeds (reply counts, "Mine", search) and the thread itself
      await queryClient.invalidateQueries({ queryKey: quackKeys.all() })
    },
  })
}
