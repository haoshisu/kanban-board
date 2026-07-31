import { type PresenceMember } from "../../realtime/useBoardPresence"

const AVATAR_COLORS = ["bg-amber-500", "bg-sky-500", "bg-emerald-500", "bg-rose-500", "bg-violet-500", "bg-cyan-500"]

const MAX_VISIBLE = 4

const hashToIndex = (value: string, length: number) => {
 let hash = 0
 for (const char of value) {
  hash = (hash * 31 + char.charCodeAt(0)) % length
 }
 return hash
}

const getInitials = (name: string) => name.trim().slice(0, 1).toUpperCase() || "?"

type PresenceAvatarsProps = { members: PresenceMember[] }

export function PresenceAvatars({ members }: PresenceAvatarsProps) {
 if (members.length === 0) return null

 const visible = members.slice(0, MAX_VISIBLE)
 const overflowCount = members.length - visible.length

 return (
  <div aria-label={`${members.length} 人正在檢視此 board`} className="flex items-center -space-x-2">
   {visible.map((member) => (
    <div
     className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-card text-xs font-semibold
         text-white ${AVATAR_COLORS[hashToIndex(member.userId, AVATAR_COLORS.length)]}`}
     key={member.userId}
     title={member.name}
    >
     {getInitials(member.name)}
    </div>
   ))}
   {overflowCount > 0 ? (
    <div
     className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card
     bg-ink-muted/40 text-xs font-semibold text-ink"
    >
     +{overflowCount}
    </div>
   ) : null}
  </div>
 )
}
