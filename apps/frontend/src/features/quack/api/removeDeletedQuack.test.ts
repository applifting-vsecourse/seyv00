import { describe, expect, it } from "vitest"

import { aDeletedQuack, aQuack, aReply } from "@/test/quacks"

import { removeDeletedQuack } from "@/features/quack/api/removeDeletedQuack"

describe("removeDeletedQuack", () => {
  it("removes a quack without replies", () => {
    const keep = aQuack({ id: "q2" })
    expect(removeDeletedQuack([aQuack(), keep], "q1")).toEqual([keep])
  })

  it("turns a quack with replies into a placeholder that keeps them", () => {
    const reply = aReply()
    const [placeholder] = removeDeletedQuack([aQuack({ replyCount: 1, replies: [reply] })], "q1")

    expect(placeholder).toEqual(aDeletedQuack([reply]))
    // nothing of the author or the text is carried over
    expect(placeholder).not.toHaveProperty("text")
    expect(placeholder).not.toHaveProperty("user")
  })

  it("keeps the count of replies the feed doesn't show", () => {
    const [placeholder] = removeDeletedQuack([aQuack({ replyCount: 5, replies: [aReply()] })], "q1")
    expect(placeholder?.replyCount).toBe(5)
  })

  it("removes a reply from its thread", () => {
    const other = aReply({ id: "r2" })
    const [thread] = removeDeletedQuack(
      [aQuack({ replyCount: 2, replies: [aReply(), other] })],
      "r1",
    )
    expect(thread?.replies).toEqual([other])
    expect(thread?.replyCount).toBe(1)
  })

  it("removes a placeholder together with its last reply", () => {
    expect(removeDeletedQuack([aDeletedQuack([aReply()])], "r1")).toEqual([])
  })

  it("keeps a placeholder that still has replies the feed doesn't show", () => {
    const [placeholder] = removeDeletedQuack([aDeletedQuack([aReply()], 2)], "r1")
    expect(placeholder?.replyCount).toBe(1)
  })

  it('removes a reply listed on its own ("Mine", search)', () => {
    const standalone = aQuack({ id: "r1", parentId: "q1" })
    expect(removeDeletedQuack([standalone], "r1")).toEqual([])
  })
})
