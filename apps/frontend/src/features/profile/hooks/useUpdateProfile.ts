import { useMutation, useQueryClient } from "@tanstack/react-query"

import { profileKeys } from "@/features/profile/api/profileKeys"
import { updateProfile } from "@/features/profile/api/updateProfile"

export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: async (profile) => {
      queryClient.setQueryData(profileKeys.mine(), profile)
      // The name and @username show up in the session, the header and every
      // quack in the feed — all owned by other features, so refresh everything.
      await queryClient.invalidateQueries()
    },
  })
}
