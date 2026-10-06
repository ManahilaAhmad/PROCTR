import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { C } from "../../theme/colors";
import { Icon } from "../../theme/icons";

export default function NotificationBell({ userId }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filterTab, setFilterTab] = useState("all"); // 'all' | 'mine'
  const [expanded, setExpanded] = useState(null); // expanded notification (or null)
  const [coords, setCoords] = useState({ top: 0, right: 0 });

  const btnRef = useRef(null);
  const panelRef = useRef(null);

  const fetchNotifications = () => {
    if (!userId) return;
    fetch(`http://localhost:5000/api/notifications/${userId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "success") {
          setNotifications(data.notifications);
          setUnreadCount(data.unread_count);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [userId]);

  // Recalculate dropdown position relative to the bell button whenever it opens
  useLayoutEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [open]);

  // Close dropdown on outside click (checks both the button and the portaled panel)
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        panelRef.current && !panelRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!open) return;
    function reposition() {
      if (!btnRef.current) return;
      const rect = btnRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  function markRead(n) {
    if (n.is_read) return;
    fetch(`http://localhost:5000/api/notifications/${n.id}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    }).then(() => {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    });
  }

  function markAllRead() {
    fetch(`http://localhost:5000/api/notifications/${userId}/read-all`, { method: "POST" }).then(() => {
      setNotifications((prev) => prev.map((x) => ({ ...x, is_read: true })));
      setUnreadCount(0);
    });
  }

  function openNotification(n) {
    markRead(n);
    setExpanded(n);
  }

  function timeAgo(dateStr) {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  // Backend now returns this directly — true only for notifications sent
  // to this exact user (personal system notifications, or "Specific" broadcasts).
  function isPersonal(n) {
    return !!n.is_personal;
  }

  const visibleNotifications =
    filterTab === "mine" ? notifications.filter(isPersonal) : notifications;

  function initials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    const chars = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0][0];
    return chars.toUpperCase();
  }

  return (
    <>
      <div style={{ position: "relative" }}>
        <button
          ref={btnRef}
          onClick={() => setOpen((o) => !o)}
          title="Notifications"
          style={{
            position: "relative",
            width: 38,
            height: 38,
            borderRadius: 10,
            border: `1.5px solid ${C.grey200}`,
            background: C.white,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: C.navy,
          }}
        >
          {Icon.bell}
          {unreadCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -5,
                right: -5,
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                background: "#e5484d",
                color: C.white,
                fontSize: 10,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 4px",
              }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Dropdown — portaled to <body> so no ancestor stacking context can clip/cover it */}
      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: coords.top,
              right: coords.right,
              width: 380,
              maxHeight: 480,
              display: "flex",
              flexDirection: "column",
              background: C.white,
              borderRadius: 12,
              boxShadow: "0 16px 48px rgba(0,0,0,.22)",
              border: `1px solid ${C.grey200}`,
              zIndex: 9999,
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                borderBottom: `1px solid ${C.grey100}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: 800, fontSize: 14, color: C.navy }}>Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  style={{ border: "none", background: "none", color: C.teal, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Filter tabs */}
            <div style={{ display: "flex", gap: 6, padding: "10px 16px 0" }}>
              {[
                { id: "all", label: "All" },
                { id: "mine", label: "Only for You" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setFilterTab(t.id)}
                  style={{
                    border: "none",
                    cursor: "pointer",
                    padding: "6px 12px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    background: filterTab === t.id ? C.navy : C.grey100,
                    color: filterTab === t.id ? C.white : C.grey500,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ overflowY: "auto", marginTop: 10 }}>
              {visibleNotifications.length === 0 ? (
                <div style={{ padding: "32px 16px", textAlign: "center", color: C.grey400, fontSize: 13 }}>
                  No notifications{filterTab === "mine" ? " for you specifically" : ""} yet.
                </div>
              ) : (
                visibleNotifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => openNotification(n)}
                    style={{
                      display: "flex",
                      gap: 10,
                      padding: "12px 16px",
                      borderBottom: `1px solid ${C.grey100}`,
                      cursor: "pointer",
                      background: n.is_read ? C.white : C.tealLight,
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: n.source === "personal" ? C.grey200 : C.navy,
                        color: n.source === "personal" ? C.grey500 : C.white,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: 11,
                        flexShrink: 0,
                      }}
                    >
                      {initials(n.sender_name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: C.navy }}>{n.title}</span>
                        {!n.is_read && (
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.teal, flexShrink: 0, marginTop: 4 }} />
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: C.grey400, marginTop: 1 }}>
                        {n.sender_name}
                        {n.scope_label ? ` · ${n.scope_label}` : ""}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: C.grey500,
                          marginTop: 3,
                          lineHeight: 1.5,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {n.message}
                      </div>
                      <div style={{ fontSize: 11, color: C.grey400, marginTop: 5 }}>{timeAgo(n.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>,
          document.body
        )}

      {/* Expanded notification modal — like opening an email */}
      {expanded &&
        createPortal(
          <div
            onClick={() => setExpanded(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(17,29,51,.55)",
              zIndex: 10000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: C.white,
                borderRadius: 16,
                padding: 32,
                width: 480,
                maxWidth: "90vw",
                boxShadow: "0 24px 64px rgba(0,0,0,.22)",
                animation: "popIn .25s cubic-bezier(.22,.68,0,1.3) both",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.navy, paddingRight: 20 }}>
                  {expanded.title}
                </h2>
                <button
                  onClick={() => setExpanded(null)}
                  style={{ border: "none", background: "none", cursor: "pointer", color: C.grey400, fontSize: 20, lineHeight: 1 }}
                >
                  ×
                </button>
              </div>

              {/* Sender row — the "email header" */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 18,
                  paddingBottom: 16,
                  borderBottom: `1px solid ${C.grey100}`,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: expanded.source === "personal" ? C.grey200 : C.tealLight,
                    color: expanded.source === "personal" ? C.grey500 : C.teal,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 14,
                    flexShrink: 0,
                  }}
                >
                  {initials(expanded.sender_name)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: C.navy }}>
                    {expanded.sender_name}
                    {expanded.sender_role ? ` (${expanded.sender_role})` : ""}
                  </div>
                  <div style={{ fontSize: 12, color: C.grey400 }}>{expanded.scope_label}</div>
                </div>
                <div style={{ marginLeft: "auto", fontSize: 12, color: C.grey400, whiteSpace: "nowrap" }}>
                  {timeAgo(expanded.created_at)}
                </div>
              </div>

              <div style={{ fontSize: 14, color: C.grey800, lineHeight: 1.7 }}>
                {expanded.message}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
