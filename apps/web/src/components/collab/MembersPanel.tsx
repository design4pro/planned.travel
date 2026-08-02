import { useEffect, useState } from "react";
import { Alert, Button, Label, ListBox, Select } from "@heroui/react";

type Role = "owner" | "editor" | "viewer";

interface Member {
  userId: string;
  role: Role;
  name: string | null;
  email: string | null;
}

interface Labels {
  title: string;
  roleOwner: string;
  roleEditor: string;
  roleViewer: string;
  you: string;
  remove: string;
  removed: string;
  roleSaved: string;
}

interface Props {
  tripId: string;
  currentUserId: string;
  labels: Labels;
}

const roleLabel = (role: Role, l: Labels) =>
  role === "owner" ? l.roleOwner : role === "editor" ? l.roleEditor : l.roleViewer;

/** Owner-only: view members, change editor↔viewer roles, remove members. */
export default function MembersPanel({ tripId, currentUserId, labels }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/trips/${tripId}/members`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setMembers(rows as Member[]))
      .catch(() => setMembers([]));
  }, [tripId]);

  async function changeRole(m: Member, role: "editor" | "viewer") {
    const res = await fetch(`/api/trips/${tripId}/members/${m.userId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      setError(labels.roleSaved);
      return;
    }
    setMembers((prev) => prev.map((x) => (x.userId === m.userId ? { ...x, role } : x)));
  }

  async function remove(m: Member) {
    const res = await fetch(`/api/trips/${tripId}/members/${m.userId}`, { method: "DELETE" });
    if (!res.ok) {
      setError(labels.removed);
      return;
    }
    setMembers((prev) => prev.filter((x) => x.userId !== m.userId));
  }

  return (
    <div className="rounded-lg border bg-card p-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {labels.title} ({members.length})
      </h3>
      <ul className="mt-3 space-y-2">
        {members.map((m) => {
          const isOwner = m.role === "owner";
          const isYou = m.userId === currentUserId;
          const display = m.name ?? m.email ?? m.userId.slice(0, 6);
          return (
            <li
              key={m.userId}
              className="flex flex-wrap items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
            >
              <span className="font-medium">
                {display} {isYou && <span className="text-muted-foreground">{labels.you}</span>}
              </span>
              {m.email && m.name && (
                <span className="text-xs text-muted-foreground">{m.email}</span>
              )}
              <span className="ml-auto flex items-center gap-2">
                {isOwner ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {roleLabel("owner", labels)}
                  </span>
                ) : (
                  <Select
                    aria-label={`${display} role`}
                    className="w-28"
                    value={m.role}
                    onChange={(value) => changeRole(m, value as "editor" | "viewer")}
                  >
                    <Label className="sr-only">{`${display} role`}</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="editor" textValue={labels.roleEditor}>
                          {labels.roleEditor}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                        <ListBox.Item id="viewer" textValue={labels.roleViewer}>
                          {labels.roleViewer}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                )}
                {!isOwner && (
                  <Button size="sm" variant="danger" onPress={() => remove(m)}>
                    {labels.remove}
                  </Button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {error && (
        <Alert className="mt-3" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{error}</Alert.Title>
          </Alert.Content>
        </Alert>
      )}
    </div>
  );
}
