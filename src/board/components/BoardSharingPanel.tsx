import { useEffect, useId, useState } from "react"
import type { SubmitEvent } from "react"
import { Modal } from "../../shared/components/Modal"
import {
 formErrorClassName,
 formFieldLabelClassName,
 formInputClassName,
 primaryButtonClassName,
 secondaryButtonClassName,
} from "../../shared/formStyles"
import { inviteBoardMember, listBoardMembers, removeBoardMember } from "../boardMembers"
import type { BoardMember } from "../boardMembers"

type BoardSharingPanelProps = {
 boardId: string
 onClose: () => void
}

export function BoardSharingPanel({ boardId, onClose }: BoardSharingPanelProps) {
 const emailId = useId()
 const [members, setMembers] = useState<BoardMember[]>([])
 const [isLoading, setIsLoading] = useState(true)
 const [loadError, setLoadError] = useState("")
 const [email, setEmail] = useState("")
 const [inviteError, setInviteError] = useState("")
 const [isInviting, setIsInviting] = useState(false)

 const refreshMembers = async () => {
  setIsLoading(true)
  setLoadError("")

  try {
   const next = await listBoardMembers(boardId)
   setMembers(next)
  } catch {
   setLoadError("無法載入成員列表")
  } finally {
   setIsLoading(false)
  }
 }

 useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect -- refreshMembers 一開頭同步呼叫 setIsLoading，是刻意的初始載入行為
  void refreshMembers()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshMembers 每次 render 都重新建立，故意不放進依賴陣列避免無窮迴圈
 }, [boardId])

 const handleInvite = async (event: SubmitEvent<HTMLFormElement>) => {
  event.preventDefault()

  if (!email.trim()) {
   setInviteError("請輸入 email")
   return
  }

  setIsInviting(true)
  setInviteError("")

  try {
   await inviteBoardMember(boardId, email.trim())
   setEmail("")
   await refreshMembers()
  } catch {
   setInviteError("邀請失敗，請確認對方已經註冊帳號")
  } finally {
   setIsInviting(false)
  }
 }

 const handleRemove = async (userId: string) => {
  await removeBoardMember(boardId, userId)
  await refreshMembers()
 }

 return (
  <Modal onClose={onClose} title="共享 Board">
   <div className="space-y-4">
    {isLoading ? (
     <p className="text-sm text-ink-muted">載入中...</p>
    ) : loadError ? (
     <p className={formErrorClassName}>{loadError}</p>
    ) : (
     <ul className="space-y-2">
      {members.map((member) => (
       <li
        className="flex items-center justify-between gap-3 rounded-[5px] border border-ink-muted/30 px-3 py-2"
        key={member.userId}
       >
        <div>
         <p className="text-sm font-medium text-ink">{member.displayName ?? member.userId}</p>
         <p className="text-xs text-ink-muted">{member.role}</p>
        </div>
        {member.role === "editor" ? (
         <button
          className="text-xs font-medium text-error hover:cursor-pointer hover:underline"
          onClick={() => void handleRemove(member.userId)}
          type="button"
         >
          移除
         </button>
        ) : null}
       </li>
      ))}
     </ul>
    )}

    <form className="space-y-2 border-t border-ink-muted/30 pt-4" onSubmit={handleInvite}>
     <label className={formFieldLabelClassName} htmlFor={emailId}>
      邀請協作者（editor）
     </label>
     <input
      className={formInputClassName}
      disabled={isInviting}
      id={emailId}
      onChange={(event) => setEmail(event.target.value)}
      placeholder="對方的 email"
      type="email"
      value={email}
     />
     {inviteError ? <p className={formErrorClassName}>{inviteError}</p> : null}
     <div className="flex gap-2">
      <button className={primaryButtonClassName} disabled={isInviting} type="submit">
       {isInviting ? "邀請中..." : "送出邀請"}
      </button>
      <button className={secondaryButtonClassName} onClick={onClose} type="button">
       關閉
      </button>
     </div>
    </form>
   </div>
  </Modal>
 )
}
