"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import { useProject } from "./project-context";

type Comment = { author: string; body: string; time: string };
type PostState = "의사결정" | "검토 중" | "검토 완료";
type Post = {
  id: string;
  state: PostState;
  stateClass: string;
  category: string;
  title: string;
  body: string;
  author: string;
  role: string;
  time: string;
  photos: string[];
  likes: number;
  attachments: number;
  comments: Comment[];
};

const initialPosts: Post[] = [
  {
    id: "BV-124",
    state: "의사결정",
    stateClass: "red",
    category: "사업성",
    title: "분양가·사업비 변동에 따른 수익성 민감도 검토",
    body: "기준 분양가와 총사업비를 각각 ±5% 조정한 민감도 분석 결과입니다. 목표 사업수익률과 금융비용 상승 시나리오를 확인하고 투자심의 상정 여부를 결정해 주세요.",
    author: "김지훈",
    role: "개발사업본부 PM",
    time: "오늘 10:32",
    photos: [],
    likes: 6,
    attachments: 3,
    comments: [
      {
        author: "박정우",
        body: "금융비용 0.5%p 상승 시나리오를 추가한 뒤 투자심의 안건으로 상정하겠습니다.",
        time: "10:41",
      },
    ],
  },
  {
    id: "FI-089",
    state: "검토 중",
    stateClass: "orange",
    category: "금융",
    title: "토지비 조달 및 브릿지론 구조 비교안",
    body: "자기자본 투입 비율과 브릿지론 만기 조건별 자금조달안을 비교했습니다. 본 PF 전환 시점과 이자비용을 고려해 우선협상 금융기관을 선정해 주세요.",
    author: "박정우",
    role: "재무·투자본부 이사",
    time: "어제 16:20",
    photos: [],
    likes: 3,
    attachments: 4,
    comments: [
      {
        author: "김슬기",
        body: "책임준공 조건과 중도상환수수료를 동일 기준으로 환산해 다시 비교해 주세요.",
        time: "어제 16:48",
      },
      {
        author: "박정우",
        body: "조건을 반영한 자금수지표와 월별 현금흐름을 오늘 중 추가하겠습니다.",
        time: "어제 17:02",
      },
    ],
  },
  {
    id: "PR-067",
    state: "검토 완료",
    stateClass: "green",
    category: "인허가",
    title: "도시개발 인허가 선행조건 및 일정 리스크 검토",
    body: "지구단위계획 변경, 교통영향평가, 환경 협의의 선후행 관계를 반영한 인허가 일정입니다. 사업계획 승인 목표일에 미치는 주요 위험을 검토 완료했습니다.",
    author: "최예진",
    role: "개발기획실 실장",
    time: "10월 27일 14:08",
    photos: [],
    likes: 5,
    attachments: 1,
    comments: [],
  },
];

const projectIssueTitles: Record<string, Array<[string, string, string]>> = {
  "eulwangri-sunset-island": [
    [
      "SI-204",
      "객실 가동률·ADR 기준 리조트 운영수지 검토",
      "객실 유형별 가동률과 평균 객실단가를 보수·기준·낙관 시나리오로 구분했습니다. 운영손익분기점과 위탁운영 수수료 조건을 검토해 주세요.",
    ],
    [
      "SI-118",
      "해상 웨딩 아일랜드 투자비 회수계획 검토",
      "행사 횟수와 대관 단가를 기준으로 부대시설 투자비 회수기간을 산정했습니다. 단계별 투자 실행 여부에 대한 의견이 필요합니다.",
    ],
  ],
  "sewoon2-district": [
    [
      "SW-091",
      "주거·업무·상업 시설별 개발이익 배분 검토",
      "시설별 분양·임대 매출과 공사비를 분리해 개발이익을 재산정했습니다. 복합개발 포트폴리오의 우선순위를 결정해 주세요.",
    ],
    [
      "SW-052",
      "공공기여·인허가 조건 반영 사업성 재검토",
      "공공기여 규모와 인허가 조건을 총사업비 및 일정에 반영했습니다. 목표 수익률 충족 여부와 대안 사업계획을 검토해 주세요.",
    ],
  ],
};

const initialPostsByProject: Record<string, Post[]> = {
  yongsan: initialPosts,
  "30000000-0000-4000-8000-000000000001": initialPosts,
  ...Object.fromEntries(
    Object.entries(projectIssueTitles).map(([projectId, definitions]) => [
      projectId,
      definitions.map(([id, title, body], index) => ({
        ...initialPosts[index % initialPosts.length]!,
        id,
        title,
        body,
        photos: [],
        comments: [],
        likes: index + 1,
      })),
    ]),
  ),
};

export function IssueFeed({
  title = "이슈 피드",
  fullPage = false,
}: {
  title?: string;
  fullPage?: boolean;
}) {
  const { selectedProject } = useProject();
  const [postsByProject, setPostsByProject] = useState(initialPostsByProject);
  const posts = useMemo(
    () => postsByProject[selectedProject.id] ?? [],
    [postsByProject, selectedProject.id],
  );
  const [openComments, setOpenComments] = useState<string | null>(
    initialPosts[0]?.id ?? null,
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<
    "전체" | "검토 중" | "의사결정" | "완료"
  >("전체");
  const [composerOpen, setComposerOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newCategory, setNewCategory] = useState("사업성");
  const [attachmentName, setAttachmentName] = useState("");
  const [menuPostId, setMenuPostId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editState, setEditState] = useState<PostState>("검토 중");
  const [editNotice, setEditNotice] = useState("");

  const updatePosts = (updater: (current: Post[]) => Post[]) => {
    setPostsByProject((current) => ({
      ...current,
      [selectedProject.id]: updater(current[selectedProject.id] ?? []),
    }));
  };

  const visiblePosts = useMemo(
    () =>
      posts.filter((post) => {
        const matchesQuery =
          `${post.title} ${post.body} ${post.id} ${post.author}`
            .toLowerCase()
            .includes(query.toLowerCase());
        const matchesFilter =
          filter === "전체" ||
          (filter === "검토 중" && post.state === "검토 중") ||
          (filter === "의사결정" && post.state === "의사결정") ||
          (filter === "완료" && post.state === "검토 완료");
        return matchesQuery && matchesFilter;
      }),
    [filter, posts, query],
  );

  const addComment = (event: FormEvent<HTMLFormElement>, postId: string) => {
    event.preventDefault();
    const body = drafts[postId]?.trim();
    if (!body) return;
    updatePosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: [
                ...post.comments,
                { author: "김지훈", body, time: "방금 전" },
              ],
            }
          : post,
      ),
    );
    setDrafts((current) => ({ ...current, [postId]: "" }));
    setOpenComments(postId);
  };

  const addPost = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newTitle.trim() || !newBody.trim()) return;
    const post: Post = {
      id: `NEW-${String(posts.length + 1).padStart(3, "0")}`,
      state: "검토 중",
      stateClass: "orange",
      category: newCategory,
      title: newTitle.trim(),
      body: newBody.trim(),
      author: "김지훈",
      role: "개발사업본부 PM",
      time: "방금 전",
      photos: attachmentName ? ["crop-3"] : [],
      likes: 0,
      attachments: attachmentName ? 1 : 0,
      comments: [],
    };
    updatePosts((current) => [post, ...current]);
    setNewTitle("");
    setNewBody("");
    setAttachmentName("");
    setComposerOpen(false);
    setFilter("전체");
  };

  const likePost = (postId: string) => {
    updatePosts((current) =>
      current.map((post) =>
        post.id === postId ? { ...post, likes: post.likes + 1 } : post,
      ),
    );
  };

  const startEdit = (post: Post) => {
    setEditingPostId(post.id);
    setEditTitle(post.title);
    setEditBody(post.body);
    setEditCategory(post.category);
    setEditState(post.state);
    setEditNotice("");
    setMenuPostId(null);
  };

  const cancelEdit = () => {
    setEditingPostId(null);
    setEditTitle("");
    setEditBody("");
    setEditCategory("");
  };

  const saveEditedPost = (
    event: FormEvent<HTMLFormElement>,
    postId: string,
  ) => {
    event.preventDefault();
    const title = editTitle.trim();
    const body = editBody.trim();
    if (!title || !body) return;

    const stateClass =
      editState === "의사결정"
        ? "red"
        : editState === "검토 완료"
          ? "green"
          : "orange";
    updatePosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              title,
              body,
              category: editCategory,
              state: editState,
              stateClass,
              time: "방금 전 · 수정됨",
            }
          : post,
      ),
    );
    cancelEdit();
    setEditNotice("게시물을 수정했습니다.");
  };

  return (
    <section className={fullPage ? "issue-feed full-page" : "issue-feed"}>
      <div className="feed-heading">
        <div>
          <h2>{title}</h2>
          <span className="feed-project-name">{selectedProject.name}</span>
          <span className="sample-tag">샘플 데이터</span>
        </div>
        <div>
          <label>
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="이슈 검색"
              placeholder="이슈 검색..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => setComposerOpen((open) => !open)}
          >
            + 새 이슈 등록
          </button>
        </div>
      </div>
      <div className="feed-tabs">
        {(["전체", "검토 중", "의사결정", "완료"] as const).map((item) => (
          <button
            className={filter === item ? "active" : ""}
            onClick={() => setFilter(item)}
            type="button"
            key={item}
          >
            {item}
          </button>
        ))}
      </div>
      {editNotice ? (
        <div className="issue-edit-notice" role="status">
          {editNotice}
          <button
            type="button"
            aria-label="수정 완료 안내 닫기"
            onClick={() => setEditNotice("")}
          >
            ×
          </button>
        </div>
      ) : null}
      <div className="feed-scroll">
        {composerOpen && (
          <form className="issue-composer" onSubmit={addPost}>
            <div>
              <strong>새 이슈 등록</strong>
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <input
              aria-label="새 이슈 제목"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="이슈 제목을 입력하세요"
              required
            />
            <textarea
              aria-label="새 이슈 내용"
              value={newBody}
              onChange={(event) => setNewBody(event.target.value)}
              placeholder="사업성 검토 내용과 의사결정 요청사항을 입력하세요"
              required
            />
            <div className="composer-options">
              <select
                aria-label="이슈 분류"
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
              >
                <option>사업성</option>
                <option>금융</option>
                <option>인허가</option>
                <option>운영</option>
              </select>
              <label className="attach-button">
                첨부파일
                <input
                  type="file"
                  accept="image/*,.pdf,.dwg"
                  onChange={(event) =>
                    setAttachmentName(event.target.files?.[0]?.name ?? "")
                  }
                />
              </label>
              <span>{attachmentName || "선택된 파일 없음"}</span>
              <button type="submit">이슈 등록</button>
            </div>
          </form>
        )}
        {visiblePosts.map((post) => (
          <article className="issue-post" key={post.id}>
            <div className="post-meta">
              <div>
                <b className={`post-state ${post.stateClass}`}>{post.state}</b>
                <span>{post.id}</span>
                <em>{post.category}</em>
              </div>
              <time>{post.time}</time>
              <div
                className="post-menu"
                onKeyDown={(event) => {
                  if (event.key === "Escape") setMenuPostId(null);
                }}
              >
                <button
                  type="button"
                  aria-label={`${post.title} 게시물 메뉴`}
                  aria-haspopup="menu"
                  aria-expanded={menuPostId === post.id}
                  onClick={() =>
                    setMenuPostId((current) =>
                      current === post.id ? null : post.id,
                    )
                  }
                >
                  ⋮
                </button>
                {menuPostId === post.id ? (
                  <div className="post-menu-popover" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => startEdit(post)}
                    >
                      <span aria-hidden="true">✎</span>
                      게시물 수정
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            {editingPostId === post.id ? (
              <form
                className="issue-edit-form"
                onSubmit={(event) => saveEditedPost(event, post.id)}
              >
                <div>
                  <strong>게시물 수정</strong>
                  <span>제목과 검토 내용을 정확하게 수정해 주세요.</span>
                </div>
                <input
                  aria-label={`${post.id} 게시물 제목 수정`}
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  maxLength={120}
                  required
                />
                <textarea
                  aria-label={`${post.id} 게시물 내용 수정`}
                  value={editBody}
                  onChange={(event) => setEditBody(event.target.value)}
                  maxLength={2000}
                  required
                />
                <div className="issue-edit-options">
                  <label>
                    <span>분류</span>
                    <select
                      aria-label={`${post.id} 게시물 분류 수정`}
                      value={editCategory}
                      onChange={(event) => setEditCategory(event.target.value)}
                    >
                      <option>사업성</option>
                      <option>금융</option>
                      <option>인허가</option>
                      <option>운영</option>
                    </select>
                  </label>
                  <label>
                    <span>진행 상태</span>
                    <select
                      aria-label={`${post.id} 게시물 상태 수정`}
                      value={editState}
                      onChange={(event) =>
                        setEditState(event.target.value as PostState)
                      }
                    >
                      <option>검토 중</option>
                      <option>의사결정</option>
                      <option>검토 완료</option>
                    </select>
                  </label>
                  <div>
                    <button type="button" onClick={cancelEdit}>
                      취소
                    </button>
                    <button type="submit">수정 저장</button>
                  </div>
                </div>
              </form>
            ) : (
              <>
                <h3>{post.title}</h3>
                <p>{post.body}</p>
              </>
            )}
            <div className="post-author">
              <span className="mini-avatar">{post.author[0]}</span>
              <strong>{post.author}</strong>
              <small>{post.role}</small>
            </div>
            {post.photos.length > 0 && (
              <div
                className={`post-photos count-${Math.min(post.photos.length, 3)}`}
              >
                {post.photos.map((photo, index) => (
                  <button
                    className={`photo-crop ${photo}`}
                    type="button"
                    aria-label={`첨부사진 ${index + 1}`}
                    key={`${post.id}-${photo}-${index}`}
                  >
                    {index === 2 && post.photos.length > 3 ? (
                      <span>+{post.photos.length - 2}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
            <div className="post-actions">
              <button
                type="button"
                onClick={() =>
                  setOpenComments(openComments === post.id ? null : post.id)
                }
              >
                ◯ <span>댓글</span> {post.comments.length}
              </button>
              <button type="button">
                ⌕ <span>첨부</span> {post.attachments}
              </button>
              <button type="button" onClick={() => likePost(post.id)}>
                ♡ <span>공감</span> {post.likes}
              </button>
              <div className="post-watchers">
                <i>김</i>
                <i>이</i>
                <i>박</i>
                <b>+2</b>
              </div>
            </div>
            {openComments === post.id && (
              <div className="comments-area">
                {post.comments.map((comment, index) => (
                  <div className="comment" key={`${post.id}-comment-${index}`}>
                    <span className="mini-avatar">{comment.author[0]}</span>
                    <div>
                      <strong>{comment.author}</strong>
                      <time>{comment.time}</time>
                      <p>{comment.body}</p>
                    </div>
                  </div>
                ))}
                {post.comments.length === 0 && (
                  <p className="empty-comment">첫 댓글을 남겨보세요.</p>
                )}
                <form onSubmit={(event) => addComment(event, post.id)}>
                  <span className="mini-avatar">김</span>
                  <input
                    aria-label={`${post.title} 댓글 입력`}
                    value={drafts[post.id] ?? ""}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [post.id]: event.target.value,
                      }))
                    }
                    placeholder="댓글을 입력하세요..."
                  />
                  <button type="submit">등록</button>
                </form>
              </div>
            )}
          </article>
        ))}
        {visiblePosts.length === 0 && (
          <div className="feed-empty">
            <strong>조건에 맞는 이슈가 없습니다.</strong>
            <span>검색어 또는 필터를 변경해 주세요.</span>
          </div>
        )}
      </div>
    </section>
  );
}
