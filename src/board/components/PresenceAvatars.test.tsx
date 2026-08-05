import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { PresenceAvatars } from "./PresenceAvatars"
import type { PresenceMember } from "../../realtime/useBoardPresence"

const member = (overrides: Partial<PresenceMember> = {}): PresenceMember => ({
 userId: "user-1",
 name: "Alice",
 ...overrides,
})

describe("PresenceAvatars", () => {
 it("renders nothing when there are no members", () => {
  const { container } = render(<PresenceAvatars members={[]} />)

  expect(container.firstChild).toBeNull()
 })

 it("renders initials and a title for each visible member", () => {
  render(
   <PresenceAvatars
    members={[member({ userId: "user-1", name: "Alice" }), member({ userId: "user-2", name: "bob" })]}
   />,
  )

  expect(screen.getByTitle("Alice")).toHaveTextContent("A")
  expect(screen.getByTitle("bob")).toHaveTextContent("B")
 })

 it("falls back to a question mark for a blank name", () => {
  const { container } = render(<PresenceAvatars members={[member({ name: "   " })]} />)

  expect(container.querySelector("[title]")).toHaveTextContent("?")
 })

 it("shows the correct aria-label for the member count", () => {
  render(
   <PresenceAvatars
    members={[member({ userId: "user-1" }), member({ userId: "user-2", name: "Bob" })]}
   />,
  )

  expect(screen.getByLabelText("2 人正在檢視此 board")).toBeVisible()
 })

 it("renders no overflow badge when exactly 4 members are present", () => {
  const members = Array.from({ length: 4 }, (_, index) => member({ userId: `user-${index}`, name: `U${index}` }))
  render(<PresenceAvatars members={members} />)

  expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument()
 })

 it("shows only the first 4 members plus an overflow badge beyond that", () => {
  const members = Array.from({ length: 6 }, (_, index) => member({ userId: `user-${index}`, name: `U${index}` }))
  render(<PresenceAvatars members={members} />)

  expect(screen.getByTitle("U0")).toBeVisible()
  expect(screen.getByTitle("U3")).toBeVisible()
  expect(screen.queryByTitle("U4")).not.toBeInTheDocument()
  expect(screen.getByText("+2")).toBeVisible()
 })

 it("assigns a deterministic avatar color for the same userId across renders", () => {
  const { container: first } = render(<PresenceAvatars members={[member({ userId: "same-user" })]} />)
  const firstClassName = first.querySelector("[title='Alice']")?.className

  const { container: second } = render(<PresenceAvatars members={[member({ userId: "same-user" })]} />)
  const secondClassName = second.querySelector("[title='Alice']")?.className

  expect(firstClassName).toBe(secondClassName)
 })
})
