import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import EmojiPicker from "emoji-picker-react";

import { supabase } from "../lib/supabase";

import Sidebar from "../components/Sidebar";
import NotificationBell from "../components/NotificationBell";

import {
  Search,
  UserPlus,
  UserCheck,
  UserX,
  MessageCircle,
  Send,
  Smile,
  Check,
  CheckCheck,
  Users,
  Clock3,
  ArrowLeft,
  Trash2,
} from "lucide-react";

import "./Dashboard.css";
import {
  ProfessorChatList,
  ProfessorConversation,
} from "../components/ProfessorChats";

import "./Friends.css";


function Friends() {
  const navigate = useNavigate();

  const bottomRef =
    useRef(null);


  // ==========================================
  // USER
  // ==========================================

  const [
    currentUser,
    setCurrentUser,
  ] = useState(null);

  const [
    profile,
    setProfile,
  ] = useState(null);


  // ==========================================
  // FRIEND DATA
  // ==========================================

  const [
    friendships,
    setFriendships,
  ] = useState([]);

  const [
    profileMap,
    setProfileMap,
  ] = useState({});

  const [
    allMessages,
    setAllMessages,
  ] = useState([]);


  // ==========================================
  // SEARCH
  // ==========================================

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const [
    searchResults,
    setSearchResults,
  ] = useState([]);

  const [
    searching,
    setSearching,
  ] = useState(false);


  // ==========================================
  // CHAT
  // ==========================================

  const [
    selectedFriend,
    setSelectedFriend,
  ] = useState(null);

  // A professor chat (professor_messages) open instead of a friend
  const [
    selectedProfessor,
    setSelectedProfessor,
  ] = useState(null);

  const [
    messages,
    setMessages,
  ] = useState([]);

  const [
    messageText,
    setMessageText,
  ] = useState("");

  const [
    showEmojiPicker,
    setShowEmojiPicker,
  ] = useState(false);


  // ==========================================
  // PAGE
  // ==========================================

  const [
    activeTab,
    setActiveTab,
  ] = useState("chats");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    pageMessage,
    setPageMessage,
  ] = useState("");


  // ==========================================
  // INITIAL LOAD
  // ==========================================

  useEffect(() => {
    initialize();
  }, []);


  async function initialize() {
    setLoading(true);


    const {
      data: { user },
      error,
    } =
      await supabase.auth.getUser();


    if (
      error ||
      !user
    ) {
      navigate("/");
      return;
    }


    setCurrentUser(
      user
    );


    const {
      data: profileData,
    } = await supabase
      .from("profiles")
      .select("*")
      .eq(
        "id",
        user.id
      )
      .maybeSingle();


    setProfile(
      profileData || null
    );


    await loadSocialData(
      user.id
    );


    setLoading(false);
  }


  // ==========================================
  // REALTIME
  // ==========================================

  useEffect(() => {
    if (!currentUser) {
      return;
    }


    const channel =
      supabase
        .channel(
          `campusmate-chat-${currentUser.id}`
        )

        .on(
          "postgres_changes",

          {
            event: "*",
            schema: "public",
            table: "messages",
          },

          async () => {

            await loadSocialData(
              currentUser.id,
              false
            );


            if (
              selectedFriend
            ) {
              await loadConversation(
                selectedFriend.id
              );
            }

          }
        )

        .on(
          "postgres_changes",

          {
            event: "*",
            schema: "public",
            table: "friendships",
          },

          async () => {

            await loadSocialData(
              currentUser.id,
              false
            );

          }
        )

        .subscribe();


    return () => {
      supabase.removeChannel(
        channel
      );
    };

  }, [
    currentUser,
    selectedFriend?.id,
  ]);


  // ==========================================
  // AUTO SCROLL
  // ==========================================

  useEffect(() => {
    bottomRef.current
      ?.scrollIntoView({
        behavior: "smooth",
      });
  }, [messages]);


  // ==========================================
  // LOAD SOCIAL DATA
  // ==========================================

  async function loadSocialData(
    userId,
    showLoader = false
  ) {
    if (showLoader) {
      setLoading(true);
    }


    const {
      data: friendshipData,
      error: friendshipError,
    } = await supabase
      .from("friendships")
      .select("*")
      .or(
        `sender_id.eq.${userId},receiver_id.eq.${userId}`
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );


    if (friendshipError) {
      console.error(
        friendshipError
      );

      setPageMessage(
        friendshipError.message
      );

      return;
    }


    const relations =
      friendshipData || [];


    setFriendships(
      relations
    );


    const userIds =
      [
        ...new Set(
          relations.flatMap(
            (friendship) => [
              friendship.sender_id,
              friendship.receiver_id,
            ]
          )
        ),
      ].filter(
        (id) =>
          id !== userId
      );


    if (
      userIds.length > 0
    ) {

      const {
        data: profiles,
      } = await supabase
        .from("profiles")
        .select(
          "id, full_name, student_id, programme"
        )
        .in(
          "id",
          userIds
        );


      const nextMap = {};


      (
        profiles || []
      ).forEach(
        (item) => {

          nextMap[item.id] =
            item;

        }
      );


      setProfileMap(
        nextMap
      );

    } else {

      setProfileMap({});

    }


    const {
      data: messageData,
      error: messageError,
    } = await supabase
      .from("messages")
      .select("*")
      .or(
        `sender_id.eq.${userId},receiver_id.eq.${userId}`
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );


    if (messageError) {
      console.error(
        messageError
      );
    }


    setAllMessages(
      messageData || []
    );


    if (showLoader) {
      setLoading(false);
    }
  }


  // ==========================================
  // FRIEND COLLECTIONS
  // ==========================================

  const acceptedFriends =
    useMemo(
      () => {

        if (!currentUser) {
          return [];
        }


        return friendships
          .filter(
            (friendship) =>
              friendship.status ===
              "accepted"
          )
          .map(
            (friendship) => {

              const friendId =
                friendship.sender_id ===
                currentUser.id
                  ? friendship.receiver_id
                  : friendship.sender_id;


              return {
                friendshipId:
                  friendship.id,

                id:
                  friendId,

                ...profileMap[
                  friendId
                ],
              };

            }
          )
          .filter(
            (friend) =>
              friend.full_name
          );

      },
      [
        friendships,
        profileMap,
        currentUser,
      ]
    );


  const incomingRequests =
    useMemo(
      () => {

        if (!currentUser) {
          return [];
        }


        return friendships
          .filter(
            (friendship) =>
              friendship.status ===
                "pending" &&
              friendship.receiver_id ===
                currentUser.id
          )
          .map(
            (friendship) => ({
              ...friendship,

              senderProfile:
                profileMap[
                  friendship.sender_id
                ],
            })
          );

      },
      [
        friendships,
        profileMap,
        currentUser,
      ]
    );


  const outgoingRequests =
    useMemo(
      () => {

        if (!currentUser) {
          return [];
        }


        return friendships
          .filter(
            (friendship) =>
              friendship.status ===
                "pending" &&
              friendship.sender_id ===
                currentUser.id
          )
          .map(
            (friendship) => ({
              ...friendship,

              receiverProfile:
                profileMap[
                  friendship.receiver_id
                ],
            })
          );

      },
      [
        friendships,
        profileMap,
        currentUser,
      ]
    );


  // ==========================================
  // RELATIONSHIP LOOKUP
  // ==========================================

  function relationshipWith(
    studentId
  ) {
    if (!currentUser) {
      return null;
    }


    return friendships.find(
      (friendship) =>
        (
          friendship.sender_id ===
            currentUser.id &&
          friendship.receiver_id ===
            studentId
        ) ||
        (
          friendship.receiver_id ===
            currentUser.id &&
          friendship.sender_id ===
            studentId
        )
    );
  }


  // ==========================================
  // SEARCH STUDENTS
  // ==========================================

  async function searchStudents(
    event
  ) {
    event?.preventDefault();

    const term =
      searchTerm.trim();


    if (
      term.length < 2
    ) {
      setSearchResults([]);
      setPageMessage(
        "Enter at least 2 characters."
      );

      return;
    }


    setSearching(true);
    setPageMessage("");


    const [
      nameResult,
      idResult,
    ] = await Promise.all([

      supabase
        .from("profiles")
        .select(
          "id, full_name, student_id, programme"
        )
        .ilike(
          "full_name",
          `%${term}%`
        )
        .limit(20),

      supabase
        .from("profiles")
        .select(
          "id, full_name, student_id, programme"
        )
        .ilike(
          "student_id",
          `%${term}%`
        )
        .limit(20),

    ]);


    const combined = [
      ...(nameResult.data || []),
      ...(idResult.data || []),
    ];


    const unique = [];


    const seen =
      new Set();


    combined.forEach(
      (student) => {

        if (
          student.id !==
            currentUser.id &&
          !seen.has(
            student.id
          )
        ) {
          seen.add(
            student.id
          );

          unique.push(
            student
          );
        }

      }
    );


    setSearchResults(
      unique
    );

    setSearching(false);
  }


  // ==========================================
  // SEND FRIEND REQUEST
  // ==========================================

  async function sendFriendRequest(
    studentId
  ) {
    setPageMessage("");


    const {
      error,
    } = await supabase
      .from("friendships")
      .insert({
        sender_id:
          currentUser.id,

        receiver_id:
          studentId,

        status:
          "pending",
      });


    if (error) {

      if (
        error.code ===
        "23505"
      ) {
        setPageMessage(
          "A friendship or request already exists."
        );
      } else {
        setPageMessage(
          error.message
        );
      }

      return;
    }


    setPageMessage(
      "Friend request sent."
    );


    await loadSocialData(
      currentUser.id
    );
  }


  // ==========================================
  // ACCEPT REQUEST
  // ==========================================

  async function acceptRequest(
    friendship
  ) {
    const {
      error,
    } = await supabase
      .from("friendships")
      .update({
        status:
          "accepted",

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        friendship.id
      );


    if (error) {
      setPageMessage(
        error.message
      );

      return;
    }


    setPageMessage(
      "Friend request accepted."
    );


    await loadSocialData(
      currentUser.id
    );


    setActiveTab(
      "chats"
    );
  }


  // ==========================================
  // REMOVE / DECLINE
  // ==========================================

  async function removeFriendship(
    friendshipId
  ) {
    const {
      error,
    } = await supabase
      .from("friendships")
      .delete()
      .eq(
        "id",
        friendshipId
      );


    if (error) {
      setPageMessage(
        error.message
      );

      return;
    }


    if (
      selectedFriend?.friendshipId ===
      friendshipId
    ) {
      setSelectedFriend(
        null
      );

      setMessages([]);
    }


    await loadSocialData(
      currentUser.id
    );
  }


  // ==========================================
  // OPEN CHAT
  // ==========================================

  async function openChat(
    friend
  ) {
    setSelectedProfessor(
      null
    );

    setSelectedFriend(
      friend
    );

    setShowEmojiPicker(
      false
    );


    await loadConversation(
      friend.id
    );


    await markMessagesRead(
      friend.id
    );
  }


  // ==========================================
  // LOAD CONVERSATION
  // ==========================================

  async function loadConversation(
    friendId
  ) {
    if (!currentUser) {
      return;
    }


    const {
      data,
      error,
    } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      );


    if (error) {
      console.error(
        "Conversation error:",
        error
      );

      return;
    }


    setMessages(
      data || []
    );
  }


  // ==========================================
  // MARK READ
  // ==========================================

  async function markMessagesRead(
    friendId
  ) {
    if (!currentUser) {
      return;
    }


    await supabase
      .from("messages")
      .update({
        is_read:
          true,
      })
      .eq(
        "receiver_id",
        currentUser.id
      )
      .eq(
        "sender_id",
        friendId
      )
      .eq(
        "is_read",
        false
      );


    await loadSocialData(
      currentUser.id
    );
  }


  // ==========================================
  // SEND MESSAGE
  // ==========================================

  async function sendMessage(
    event
  ) {
    event.preventDefault();


    const cleanMessage =
      messageText.trim();


    if (
      !cleanMessage ||
      !selectedFriend
    ) {
      return;
    }


    setMessageText("");
    setShowEmojiPicker(
      false
    );


    const {
      data,
      error,
    } = await supabase
      .from("messages")
      .insert({
        sender_id:
          currentUser.id,

        receiver_id:
          selectedFriend.id,

        message:
          cleanMessage,

        is_read:
          false,
      })
      .select()
      .single();


    if (error) {
      setPageMessage(
        error.message
      );

      setMessageText(
        cleanMessage
      );

      return;
    }


    setMessages(
      (current) => [
        ...current,
        data,
      ]
    );


    await loadSocialData(
      currentUser.id
    );
  }


  // ==========================================
  // DELETE OWN MESSAGE
  // ==========================================

  async function deleteMessage(
    message
  ) {
    if (
      message.sender_id !==
      currentUser.id
    ) {
      return;
    }


    const {
      error,
    } = await supabase
      .from("messages")
      .delete()
      .eq(
        "id",
        message.id
      );


    if (error) {
      setPageMessage(
        error.message
      );

      return;
    }


    setMessages(
      (current) =>
        current.filter(
          (item) =>
            item.id !==
            message.id
        )
    );


    await loadSocialData(
      currentUser.id
    );
  }


  // ==========================================
  // EMOJI
  // ==========================================

  function addEmoji(
    emojiData
  ) {
    setMessageText(
      (current) =>
        current +
        emojiData.emoji
    );
  }


  // ==========================================
  // CHAT HELPERS
  // ==========================================

  function lastMessageFor(
    friendId
  ) {
    return allMessages.find(
      (message) =>
        (
          message.sender_id ===
            currentUser?.id &&
          message.receiver_id ===
            friendId
        ) ||
        (
          message.sender_id ===
            friendId &&
          message.receiver_id ===
            currentUser?.id
        )
    );
  }


  function unreadFor(
    friendId
  ) {
    return allMessages.filter(
      (message) =>
        message.sender_id ===
          friendId &&
        message.receiver_id ===
          currentUser?.id &&
        !message.is_read
    ).length;
  }


  function formatTime(
    value
  ) {
    if (!value) {
      return "";
    }


    return new Date(
      value
    ).toLocaleTimeString(
      [],
      {
        hour:
          "2-digit",

        minute:
          "2-digit",
      }
    );
  }


  // "Today", "Yesterday", a weekday, or a date -
  // shown as a small chip when the day changes in a chat.
  function formatDayLabel(
    value
  ) {
    if (!value) {
      return "";
    }

    const date =
      new Date(value);

    const today =
      new Date();

    const startOf = (day) =>
      new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate()
      ).getTime();

    const daysAgo =
      Math.round(
        (startOf(today) - startOf(date)) /
          (24 * 60 * 60 * 1000)
      );

    if (daysAgo === 0) {
      return "Today";
    }

    if (daysAgo === 1) {
      return "Yesterday";
    }

    if (daysAgo < 7) {
      return date.toLocaleDateString(
        [],
        { weekday: "long" }
      );
    }

    return date.toLocaleDateString(
      [],
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    );
  }


  function formatConversationTime(
    value
  ) {
    if (!value) {
      return "";
    }


    const date =
      new Date(value);

    const today =
      new Date();


    const sameDay =
      date.toDateString() ===
      today.toDateString();


    if (sameDay) {
      return formatTime(
        value
      );
    }


    return date.toLocaleDateString(
      "en-GB",
      {
        day:
          "2-digit",

        month:
          "short",
      }
    );
  }


  function initials(
    name
  ) {
    return (
      name
        ?.split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map(
          (part) =>
            part
              .charAt(0)
              .toUpperCase()
        )
        .join("") ||
      "S"
    );
  }


  // ==========================================
  // PROFILE
  // ==========================================

  const displayName =
    profile?.full_name ||
    "Student";


  const programme =
    profile?.programme ||
    "Student";


  const firstName =
    displayName
      .trim()
      .split(" ")[0] ||
    "Student";


  // ==========================================
  // PAGE
  // ==========================================

  return (
    <div className="dashboard-page">

      <Sidebar />


      <main className="dashboard-main">

        {/* TOP BAR */}

        <header className="topbar">

          <div aria-hidden="true" />


          <div className="topbar-right">

            <NotificationBell />


            <div className="profile-circle">

              {firstName
                .charAt(0)
                .toUpperCase()}

            </div>


            <div className="profile-text">

              <strong>
                {displayName}
              </strong>

              <small>
                {programme}
              </small>

            </div>

          </div>

        </header>


        <div className="friends-content">

          {/* HEADER */}

          <div className="friends-page-header">

            <div>

              <h1>
                Friends & Chat
              </h1>

              <p>
                Connect with CampusMate
                students and chat in
                real time.
              </p>

            </div>

          </div>


          {pageMessage && (

            <div className="friends-message">

              {pageMessage}

            </div>

          )}


          {/* MAIN WHATSAPP-STYLE AREA */}

          <section className="chat-shell">

            {/* =================================
                LEFT COLUMN
            ================================== */}

            <aside className={`chat-sidebar ${
              (selectedFriend || selectedProfessor)
                ? "mobile-hidden"
                : ""
            }`}>

              {/* TABS */}

              <div className="social-tabs">

                <button
                  type="button"
                  className={
                    activeTab ===
                    "chats"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveTab(
                      "chats"
                    )
                  }
                >

                  <MessageCircle
                    size={17}
                  />

                  Chats

                </button>


                <button
                  type="button"
                  className={
                    activeTab ===
                    "requests"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveTab(
                      "requests"
                    )
                  }
                >

                  <UserPlus
                    size={17}
                  />

                  Requests

                  {incomingRequests.length >
                    0 && (

                    <span>
                      {
                        incomingRequests.length
                      }
                    </span>

                  )}

                </button>


                <button
                  type="button"
                  className={
                    activeTab ===
                    "find"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveTab(
                      "find"
                    )
                  }
                >

                  <Search
                    size={17}
                  />

                  Find

                </button>

              </div>


              {/* ===============================
                  CHAT LIST
              ================================ */}

              {activeTab ===
                "chats" && (

                <div className="conversation-list">

                  <ProfessorChatList
                    currentUserId={
                      currentUser?.id
                    }
                    selectedId={
                      selectedProfessor?.id
                    }
                    onSelect={(professor) => {
                      setSelectedFriend(null);
                      setShowEmojiPicker(false);
                      setSelectedProfessor(professor);
                    }}
                  />


                  {loading ? (

                    <div className="friends-empty">
                      Loading...
                    </div>

                  ) : acceptedFriends.length ===
                    0 ? (

                    <div className="friends-empty">

                      <Users
                        size={38}
                      />

                      <h3>
                        No friends yet
                      </h3>

                      <p>
                        Find another student
                        and send a friend
                        request.
                      </p>

                    </div>

                  ) : (

                    acceptedFriends.map(
                      (friend) => {

                        const last =
                          lastMessageFor(
                            friend.id
                          );


                        const unread =
                          unreadFor(
                            friend.id
                          );


                        return (

                          <button
                            type="button"
                            key={
                              friend.id
                            }
                            className={`conversation-item ${
                              selectedFriend?.id ===
                              friend.id
                                ? "active"
                                : ""
                            }`}
                            onClick={() =>
                              openChat(
                                friend
                              )
                            }
                          >

                            <div className="friend-avatar">

                              {initials(
                                friend.full_name
                              )}

                            </div>


                            <div className="conversation-main">

                              <div className="conversation-name-row">

                                <strong>

                                  {
                                    friend.full_name
                                  }

                                </strong>


                                <small>

                                  {formatConversationTime(
                                    last?.created_at
                                  )}

                                </small>

                              </div>


                              <div className="conversation-preview-row">

                                <p>

                                  {last
                                    ? `${
                                        last.sender_id ===
                                        currentUser.id
                                          ? "You: "
                                          : ""
                                      }${last.message}`
                                    : "Start a conversation"}

                                </p>


                                {unread >
                                  0 && (

                                  <span className="chat-unread">

                                    {unread}

                                  </span>

                                )}

                              </div>

                            </div>

                          </button>

                        );
                      }
                    )

                  )}

                </div>

              )}


              {/* ===============================
                  REQUESTS
              ================================ */}

              {activeTab ===
                "requests" && (

                <div className="requests-section">

                  <h3>
                    Friend Requests
                  </h3>


                  {incomingRequests.length ===
                  0 ? (

                    <div className="friends-empty small">

                      No new requests.

                    </div>

                  ) : (

                    incomingRequests.map(
                      (request) => {

                        const student =
                          request.senderProfile;


                        return (

                          <div
                            className="request-card"
                            key={
                              request.id
                            }
                          >

                            <div className="friend-avatar">

                              {initials(
                                student?.full_name
                              )}

                            </div>


                            <div className="request-info">

                              <strong>

                                {
                                  student?.full_name ||
                                  "Student"
                                }

                              </strong>

                              <small>

                                {
                                  student?.programme ||
                                  "CampusMate student"
                                }

                              </small>

                            </div>


                            <div className="request-actions">

                              <button
                                type="button"
                                className="accept-request"
                                onClick={() =>
                                  acceptRequest(
                                    request
                                  )
                                }
                                title="Accept"
                              >

                                <UserCheck
                                  size={16}
                                />

                              </button>


                              <button
                                type="button"
                                className="decline-request"
                                onClick={() =>
                                  removeFriendship(
                                    request.id
                                  )
                                }
                                title="Decline"
                              >

                                <UserX
                                  size={16}
                                />

                              </button>

                            </div>

                          </div>

                        );
                      }
                    )

                  )}


                  {outgoingRequests.length >
                    0 && (

                    <>

                      <h3 className="outgoing-title">
                        Sent Requests
                      </h3>


                      {outgoingRequests.map(
                        (request) => {

                          const student =
                            request.receiverProfile;


                          return (

                            <div
                              className="request-card"
                              key={
                                request.id
                              }
                            >

                              <div className="friend-avatar">

                                {initials(
                                  student?.full_name
                                )}

                              </div>


                              <div className="request-info">

                                <strong>

                                  {
                                    student?.full_name ||
                                    "Student"
                                  }

                                </strong>

                                <small>
                                  Request pending
                                </small>

                              </div>


                              <button
                                type="button"
                                className="cancel-request"
                                onClick={() =>
                                  removeFriendship(
                                    request.id
                                  )
                                }
                              >
                                Cancel
                              </button>

                            </div>

                          );
                        }
                      )}

                    </>

                  )}

                </div>

              )}


              {/* ===============================
                  FIND STUDENTS
              ================================ */}

              {activeTab ===
                "find" && (

                <div className="find-students">

                  <form
                    className="student-search"
                    onSubmit={
                      searchStudents
                    }
                  >

                    <Search
                      size={17}
                    />

                    <input
                      value={
                        searchTerm
                      }
                      onChange={(event) =>
                        setSearchTerm(
                          event.target.value
                        )
                      }
                      placeholder="Search name or student ID..."
                    />

                    <button
                      type="submit"
                    >
                      Search
                    </button>

                  </form>


                  {searching ? (

                    <div className="friends-empty small">
                      Searching...
                    </div>

                  ) : searchResults.length ===
                    0 ? (

                    <div className="friends-empty small">

                      Search for another
                      CampusMate student.

                    </div>

                  ) : (

                    <div className="student-results">

                      {searchResults.map(
                        (student) => {

                          const relation =
                            relationshipWith(
                              student.id
                            );


                          return (

                            <div
                              key={
                                student.id
                              }
                              className="student-result-card"
                            >

                              <div className="friend-avatar">

                                {initials(
                                  student.full_name
                                )}

                              </div>


                              <div className="student-result-info">

                                <strong>

                                  {
                                    student.full_name
                                  }

                                </strong>

                                <small>

                                  {student.student_id
                                    ? `${student.student_id} • `
                                    : ""}

                                  {student.programme ||
                                    "Student"}

                                </small>

                              </div>


                              {!relation ? (

                                <button
                                  type="button"
                                  className="add-friend-btn"
                                  onClick={() =>
                                    sendFriendRequest(
                                      student.id
                                    )
                                  }
                                >

                                  <UserPlus
                                    size={16}
                                  />

                                  Add

                                </button>

                              ) : relation.status ===
                                "accepted" ? (

                                <button
                                  type="button"
                                  className="message-friend-btn"
                                  onClick={() => {

                                    const friend =
                                      acceptedFriends.find(
                                        (item) =>
                                          item.id ===
                                          student.id
                                      );


                                    if (
                                      friend
                                    ) {
                                      openChat(
                                        friend
                                      );

                                      setActiveTab(
                                        "chats"
                                      );
                                    }

                                  }}
                                >

                                  <MessageCircle
                                    size={16}
                                  />

                                  Message

                                </button>

                              ) : (

                                <span className="request-pending-label">

                                  <Clock3
                                    size={14}
                                  />

                                  Pending

                                </span>

                              )}

                            </div>

                          );
                        }
                      )}

                    </div>

                  )}

                </div>

              )}

            </aside>


            {/* =================================
                RIGHT CHAT
            ================================== */}

            <div className={`chat-main ${
              (selectedFriend || selectedProfessor)
                ? "has-chat"
                : ""
            }`}>

              {selectedProfessor ? (

                <ProfessorConversation
                  professor={
                    selectedProfessor
                  }
                  currentUserId={
                    currentUser?.id
                  }
                  onBack={() =>
                    setSelectedProfessor(null)
                  }
                />

              ) : !selectedFriend ? (

                <div className="no-chat-selected">

                  <div className="no-chat-icon">

                    💬

                  </div>

                  <h2>
                    CampusMate Chat
                  </h2>

                  <p>
                    Select a friend to start
                    chatting.
                  </p>

                  <small>
                    Private messages between
                    CampusMate friends.
                  </small>

                </div>

              ) : (

                <>

                  {/* CHAT HEADER */}

                  <div className="chat-header">

                    <button
                      type="button"
                      className="chat-back-btn"
                      onClick={() =>
                        setSelectedFriend(
                          null
                        )
                      }
                    >

                      <ArrowLeft
                        size={20}
                      />

                    </button>


                    <div className="friend-avatar">

                      {initials(
                        selectedFriend.full_name
                      )}

                    </div>


                    <div className="chat-header-info">

                      <strong>

                        {
                          selectedFriend.full_name
                        }

                      </strong>

                      <small>

                        {selectedFriend.programme ||
                          "CampusMate friend"}

                      </small>

                    </div>


                    <button
                      type="button"
                      className="unfriend-btn"
                      title="Remove friend"
                      onClick={() => {

                        const confirmed =
                          window.confirm(
                            `Remove ${selectedFriend.full_name} from your friends?`
                          );


                        if (
                          confirmed
                        ) {
                          removeFriendship(
                            selectedFriend.friendshipId
                          );
                        }

                      }}
                    >

                      <UserX
                        size={18}
                      />

                    </button>

                  </div>


                  {/* MESSAGES */}

                  <div className="chat-messages">

                    {messages.length ===
                    0 ? (

                      <div className="start-conversation">

                        <MessageCircle
                          size={37}
                        />

                        <p>
                          Start your conversation
                          with{" "}
                          {
                            selectedFriend.full_name
                          }{" "}
                          👋
                        </p>

                      </div>

                    ) : (

                      messages.map(
                      (message, index) => {
                          const mine =
                            message.sender_id ===
                            currentUser.id;

                          const previous =
                            messages[index - 1];

                          const dayLabel =
                            formatDayLabel(
                              message.created_at
                            );

                          const newDay =
                            !previous ||
                            formatDayLabel(
                              previous.created_at
                            ) !== dayLabel;

                          // First bubble of a run from the same person gets a "tail".
                          const firstInGroup =
                            newDay ||
                            previous.sender_id !==
                              message.sender_id;


                          return (
                            <Fragment
                              key={
                                message.id
                              }
                            >
                              {newDay && (
                                <div className="chat-day-chip">
                                  <span>
                                    {dayLabel}
                                  </span>
                                </div>
                              )}

                              <div
                                className={`message-row ${
                                  mine
                                    ? "mine"
                                    : "theirs"
                                } ${
                                  firstInGroup
                                    ? "first"
                                    : ""
                                }`}
                              >

                              <div className="message-bubble">

                                <p>
                                  {
                                    message.message
                                  }
                                </p>


                                <div className="message-meta">

                                  <span>

                                    {formatTime(
                                      message.created_at
                                    )}

                                  </span>


                                  {mine && (

                                    message.is_read ? (

                                      <CheckCheck
                                        size={14}
                                        className="read-ticks"
                                      />

                                    ) : (

                                      <Check
                                        size={14}
                                      />

                                    )

                                  )}

                                </div>


                                {mine && (

                                  <button
                                    type="button"
                                    className="delete-message"
                                    title="Delete message"
                                    onClick={() =>
                                      deleteMessage(
                                        message
                                      )
                                    }
                                  >

                                    <Trash2
                                      size={12}
                                    />

                                  </button>

                                )}

                              </div>

                            </div>
                            </Fragment>

                          );
                        }
                      )

                    )}


                    <div
                      ref={
                        bottomRef
                      }
                    />

                  </div>


                  {/* EMOJI PICKER */}

                  {showEmojiPicker && (

                    <div className="emoji-picker-wrapper">

                      <EmojiPicker
                        onEmojiClick={
                          addEmoji
                        }
                        width={330}
                        height={400}
                        searchDisabled={
                          false
                        }
                        previewConfig={{
                          showPreview:
                            false,
                        }}
                      />

                    </div>

                  )}


                  {/* MESSAGE INPUT */}

                  <form
                    className="chat-input-bar"
                    onSubmit={
                      sendMessage
                    }
                  >

                    <button
                      type="button"
                      className="emoji-button"
                      onClick={() =>
                        setShowEmojiPicker(
                          (current) =>
                            !current
                        )
                      }
                    >

                      <Smile
                        size={23}
                      />

                    </button>


                    <input
                      type="text"
                      value={
                        messageText
                      }
                      onChange={(event) =>
                        setMessageText(
                          event.target.value
                        )
                      }
                      placeholder="Type a message..."
                      autoComplete="off"
                    />


                    <button
                      type="submit"
                      className="send-message-btn"
                      disabled={
                        !messageText.trim()
                      }
                    >

                      <Send
                        size={20}
                      />

                    </button>

                  </form>

                </>

              )}

            </div>

          </section>

        </div>

      </main>

    </div>
  );
}


export default Friends;
