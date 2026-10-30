import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  supabase,
} from "../lib/supabase";

import "./UserAvatar.css";

function UserAvatar({
  profile = null,
  userId = null,
  name = "User",
  size = 44,
  className = "",
}) {
  const [loadedProfile, setLoadedProfile] = useState(profile);
  const [imageFailed, setImageFailed] = useState(false);
  const [cacheVersion] = useState(() => Date.now());

  useEffect(() => {
    let active = true;

    async function loadAvatarProfile() {
      if (
        profile &&
        Object.prototype.hasOwnProperty.call(profile, "avatar_path")
      ) {
        setLoadedProfile(profile);
        setImageFailed(false);
        return;
      }

      let targetUserId = userId || profile?.id || null;

      if (!targetUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        targetUserId = user?.id || null;
      }

      if (!targetUserId) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_path")
        .eq("id", targetUserId)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error("Avatar profile error:", error);
        return;
      }

      setLoadedProfile(data || profile);
      setImageFailed(false);
    }

    loadAvatarProfile();

    return () => {
      active = false;
    };
  }, [profile, userId]);

  const displayName = loadedProfile?.full_name || profile?.full_name || name || "User";
  const initial = displayName.trim().charAt(0).toUpperCase() || "U";

  const avatarUrl = useMemo(() => {
    const path = loadedProfile?.avatar_path;
    if (!path) return "";

    const { data } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);

    if (!data?.publicUrl) return "";
    return `${data.publicUrl}?v=${cacheVersion}`;
  }, [loadedProfile?.avatar_path, cacheVersion]);

  return (
    <div
      className={`campusmate-user-avatar ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        fontSize: `${Math.max(12, Math.round(size * 0.37))}px`,
      }}
      title={displayName}
    >
      {avatarUrl && !imageFailed ? (
        <img
          src={avatarUrl}
          alt={`${displayName} profile`}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}

export default UserAvatar;
