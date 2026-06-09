const storageKey = "portfolio-projects";
const clickStorageKey = "portfolio-project-clicks";
const pageType = document.body.dataset.page || "public";
let cloudProjects = [];
const GAS_API_URL ="https://script.google.com/macros/s/AKfycbwYRux2BuFOVmeTSNFe3c2S5Gfz0809bPF_CufVqGAIJ4VV4EsPauGFDtxuhh5ElH4/exec";
const siteHeader = document.querySelector(".site-header");
const projectsGrid = document.querySelector("#projectsGrid");
const projectDetailPanel = document.querySelector("#projectDetailPanel");
const heroThreeCanvas = document.querySelector("#heroThree");
const heroCategoryButtons = document.querySelectorAll("[data-project-filter]");
const skillConstellation = document.querySelector("#skillConstellation");
const projectForm = document.querySelector("#projectForm");
const sortButtons = document.querySelectorAll("[data-sort]");
const viewButtons = document.querySelectorAll("[data-view]");
const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");
const formTitle = document.querySelector("#formTitle");
const submitProject = document.querySelector("#submitProject");
const cancelEdit = document.querySelector("#cancelEdit");
const clearSavedProjects = document.querySelector("#clearSavedProjects");
const projectCount = document.querySelector("#projectCount");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let currentSort = "date-desc";
let currentView = "cards";
let currentSkillFilter = "all";
let threeModulePromise = null;
const revealObserver = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16 })
  : null;
const detailObserver = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          detailObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.22, rootMargin: "0px 0px -8% 0px" })
  : null;

function createId() {
  return `project-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSavedProjects() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch (error) {
    return [];
  }
}

function setSavedProjects(projects) {
  localStorage.setItem(storageKey, JSON.stringify(projects));
}

function getClickCounts() {
  try {
    return JSON.parse(localStorage.getItem(clickStorageKey)) || {};
  } catch (error) {
    return {};
  }
}

function setClickCounts(clickCounts) {
  localStorage.setItem(clickStorageKey, JSON.stringify(clickCounts));
}

function getProjectClicks(id) {
  return getClickCounts()[id] || 0;
}

function formatProjectDate(value) {
  if (!value) return "";
  const rawValue = String(value);
  const isoDate = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return isoDate[0];

  const parsedDate = new Date(rawValue);
  if (Number.isNaN(parsedDate.getTime())) return rawValue;

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function incrementProjectClicks(id) {
  const clickCounts = getClickCounts();
  clickCounts[id] = (clickCounts[id] || 0) + 1;
  setClickCounts(clickCounts);
  renderProjects();
}

function normalizeProject(project, index, isDefault = false) {
  const titleSlug = String(project.title || "project")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]/g, "");
  const fallbackId = isDefault ? `default-${index}` : `saved-${index}-${titleSlug}`;
  return {
    id: project.id || fallbackId,
    title: project.title || "未命名作品",
    type: project.type || (projectTypes.includes(project.category) ? project.category : "網頁"),
    category: projectTypes.includes(project.category) ? "作品" : project.category || "作品",
    date: formatProjectDate(project.date || "2026-01-01"),
    description: project.description || "",
    detail: project.detail || project.description || "",
    role: project.role || "作品製作",
    tools: project.tools || "未提供",
    link: project.link || "",
    image: project.image || "",
    isDefault,
    clicks: getProjectClicks(project.id || fallbackId)
  };
}

function getAllProjects() {
  const remoteProjects = cloudProjects.map((project, index) => normalizeProject(project, index, true));
  const localFallbackProjects = getSavedProjects().map((project, index) => normalizeProject(project, index));

  if (remoteProjects.length > 0) {
    return remoteProjects;
  }

  return localFallbackProjects.length > 0
    ? localFallbackProjects
    : defaultProjects.map((project, index) => normalizeProject(project, index, true));
}

function getFilteredProjects(projects) {
  if (currentSkillFilter === "all") return projects;
  if (projectTypes.includes(currentSkillFilter)) {
    return projects.filter((project) => project.type === currentSkillFilter);
  }

  const keywordMap = {
    code: ["Python", "Java", "JavaScript", "C#", "C++", "程式", "前端"],
    tool: ["Git", "Visual Studio", "Unity", "Blender", "工具"]
  };
  const keywords = keywordMap[currentSkillFilter] || [];
  return projects.filter((project) => {
    const haystack = `${project.title} ${project.category} ${project.description} ${project.detail} ${project.role} ${project.tools}`;
    return keywords.some((keyword) => haystack.toLowerCase().includes(keyword.toLowerCase()));
  });
}

function getSortedProjects(projects) {
  return [...projects].sort((a, b) => {
    if (currentSort === "name-asc") {
      return a.title.localeCompare(b.title, "zh-Hant");
    }

    if (currentSort === "clicks-desc") {
      return b.clicks - a.clicks || b.date.localeCompare(a.date);
    }

    return b.date.localeCompare(a.date) || a.title.localeCompare(b.title, "zh-Hant");
  });
}

function getTypeIcon(type) {
  if (type === "遊戲") return "G";
  if (type === "3D建模") return "3D";
  return "W";
}

function getViewMode() {
  return currentView;
}

function updateControlButtons(buttons, activeValue, attributeName) {
  buttons.forEach((button) => {
    const isActive = button.dataset[attributeName] === activeValue;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function appendProjectActions(content, project) {
  if (pageType !== "admin") return;

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const editButton = document.createElement("button");
  editButton.className = "button secondary small-button";
  editButton.type = "button";
  editButton.textContent = "編輯";
  editButton.addEventListener("click", () => editProject(project));

  const deleteButton = document.createElement("button");
  deleteButton.className = "button danger small-button";
  deleteButton.type = "button";
  deleteButton.textContent = "刪除";
  deleteButton.title = "刪除此作品";
  deleteButton.addEventListener("click", () => deleteProject(project.id));

  actions.append(editButton, deleteButton);
  content.appendChild(actions);
}

function createProjectCard(project, index, viewMode = "cards") {
  const article = document.createElement("article");
  article.className = `project-card project-card--${viewMode} reveal`;

  const thumb = document.createElement("div");
  thumb.className = "project-thumb";

  if (project.image) {
    const image = document.createElement("img");
    image.src = project.image;
    image.alt = project.title;
    thumb.appendChild(image);
  } else {
    const fallback = document.createElement("span");
    fallback.textContent = String(index + 1).padStart(2, "0");
    thumb.appendChild(fallback);
  }

  const content = document.createElement("div");
  content.className = "project-content";

  if (viewMode === "icons") {
    content.innerHTML = `
      <div class="project-icon"></div>
      <div>
        <span class="project-category"></span>
        <h3></h3>
        <div class="project-meta"></div>
      </div>
    `;
    content.querySelector(".project-icon").textContent = getTypeIcon(project.type);
  } else if (viewMode === "details") {
    content.innerHTML = `
      <span class="project-category"></span>
      <h3></h3>
      <div class="project-meta"></div>
      <dl class="project-details">
        <div><dt>類別</dt><dd></dd></div>
        <div><dt>日期</dt><dd></dd></div>
        <div><dt>點擊</dt><dd></dd></div>
      </dl>
      <p></p>
    `;
    const detailItems = content.querySelectorAll(".project-details dd");
    detailItems[0].textContent = project.type;
    detailItems[1].textContent = project.date;
    detailItems[2].textContent = `${project.clicks} 次`;
    content.querySelector("p").textContent = project.description;
  } else {
    content.innerHTML = `
      <span class="project-category"></span>
      <h3></h3>
      <div class="project-meta"></div>
      <p></p>
    `;
    content.querySelector("p").textContent = project.description;
  }

  content.querySelector(".project-category").textContent = project.category;
  content.querySelector("h3").textContent = project.title;
  content.querySelector(".project-meta").textContent = `${project.date} · ${project.clicks} 次點擊`;

  const link = document.createElement("a");
  link.className = "text-link";
  link.href = `project.html?id=${encodeURIComponent(project.id)}`;
  link.textContent = "查看作品";
  link.addEventListener("click", () => incrementProjectClicks(project.id));
  content.appendChild(link);

  appendProjectActions(content, project);

  article.append(thumb, content);
  return article;
}

function renderProjects() {
  if (!projectsGrid) return;

  projectsGrid.replaceChildren();
  const projects = getFilteredProjects(getAllProjects());
  const sortedProjects = getSortedProjects(projects);
  const viewMode = getViewMode();

  projectTypes.forEach((type) => {
    const projectsInType = sortedProjects.filter((project) => project.type === type);
    const categorySection = document.createElement("section");
    categorySection.className = "category-section reveal";

    const heading = document.createElement("div");
    heading.className = "category-heading";
    heading.innerHTML = `
      <div>
        <p class="eyebrow"></p>
        <h3></h3>
      </div>
      <span></span>
    `;
    heading.querySelector(".eyebrow").textContent = "Category";
    heading.querySelector("h3").textContent = type;
    heading.querySelector("span").textContent = `${projectsInType.length} 件作品`;

    const categoryGrid = document.createElement("div");
    categoryGrid.className = `category-grid category-grid--${viewMode}`;

    if (projectsInType.length > 0) {
      projectsInType.forEach((project, index) => {
        const card = createProjectCard(project, index, viewMode);
        categoryGrid.appendChild(card);
      });
    } else {
      const empty = document.createElement("p");
      empty.className = "empty-message";
      empty.textContent = "這個類別目前還沒有作品。";
      categoryGrid.appendChild(empty);
    }

    categorySection.append(heading, categoryGrid);
    projectsGrid.appendChild(categorySection);
  });

  if (projectCount) {
    projectCount.textContent = projects.length;
  }

  observeReveals(projectsGrid.querySelectorAll(".reveal"));
  setupProjectTilt(projectsGrid.querySelectorAll(".project-card"));
}

function getInitialDetailProject(projects) {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("id");
  return projects.find((project) => project.id === projectId) || projects[0];
}

function updateProjectDetail(projectId, shouldUpdateUrl = false) {
  if (!projectDetailPanel) return;

  const projects = getSortedProjects(getAllProjects());
  const project = projects.find((item) => item.id === projectId) || projects[0];
  if (!project) return;

  const detailVisual = document.querySelector("#detailVisual");
  const detailLink = document.querySelector("#detailLink");

  projectDetailPanel.classList.remove("is-visible");
  projectDetailPanel.querySelectorAll(".detail-animate").forEach((element) => {
    element.classList.remove("is-visible");
  });
  window.setTimeout(() => {
    if (detailVisual) {
      detailVisual.replaceChildren();
      if (project.image) {
        const image = document.createElement("img");
        image.src = project.image;
        image.alt = project.title;
        detailVisual.appendChild(image);
      } else {
        const marker = document.createElement("span");
        marker.textContent = getTypeIcon(project.type);
        detailVisual.appendChild(marker);
      }
    }

    document.querySelector("#detailCategory").textContent = project.category;
    document.querySelector("#detailTitle").textContent = project.title;
    document.querySelector("#detailSummary").textContent = project.description;
    document.querySelector("#detailType").textContent = project.type;
    document.querySelector("#detailDate").textContent = project.date;
    document.querySelector("#detailClicks").textContent = `${project.clicks} 次`;
    document.querySelector("#detailText").textContent = project.detail;
    document.querySelector("#detailRole").textContent = `負責項目：${project.role}`;
    document.querySelector("#detailTools").textContent = `使用工具：${project.tools}`;

    if (detailLink) {
      detailLink.href = project.link || "#";
      detailLink.classList.toggle("is-disabled", !project.link || project.link === "#");
      detailLink.onclick = (event) => {
        if (!project.link || project.link === "#") {
          event.preventDefault();
          return;
        }
        incrementProjectClicks(project.id);
      };
    }

    projectDetailPanel.classList.add("is-visible");
    observeDetailAnimations();

    if (shouldUpdateUrl) {
      const nextUrl = `${window.location.pathname}?id=${encodeURIComponent(project.id)}`;
      window.history.replaceState({}, "", nextUrl);
    }
  }, 120);
}

function renderDetailPage() {
  if (!projectDetailPanel) return;

  const projects = getSortedProjects(getAllProjects());
  const activeProject = getInitialDetailProject(projects);
  updateProjectDetail(activeProject?.id);
}

function observeReveals(targets) {
  targets.forEach((target) => {
    target.classList.add("reveal");
    if (revealObserver) {
      revealObserver.observe(target);
    } else {
      target.classList.add("is-visible");
    }
  });
}

function observeDetailAnimations() {
  document.querySelectorAll(".detail-animate").forEach((target) => {
    if (detailObserver) {
      detailObserver.observe(target);
    } else {
      target.classList.add("is-visible");
    }
  });
}

function updateHeaderState() {
  if (!siteHeader) return;
  siteHeader.classList.toggle("is-scrolled", window.scrollY > 8);
}

function preloadNextPage(url) {
  const prefetchLink = document.createElement("link");
  prefetchLink.rel = "prefetch";
  prefetchLink.href = url.href;
  prefetchLink.as = "document";
  document.head.appendChild(prefetchLink);

  if ("fetch" in window) {
    fetch(url.href, { cache: "force-cache" }).catch(() => {});
  }
}

function setupPageTransitions() {
  const isPublicHome = document.body.dataset.page === "public";

  if (isPublicHome) {
    document.body.classList.add("is-intro-loading");
    window.setTimeout(() => {
      document.body.classList.add("is-holding");
    }, 2000);
    window.setTimeout(() => {
      document.body.classList.add("is-intro-revealing");
    }, 5000);
    window.setTimeout(() => {
      document.body.classList.remove("is-intro-loading", "is-holding", "is-intro-revealing");
    }, 7000);
  } else {
    document.body.classList.add("is-loaded");
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link) return;

    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || link.target === "_blank" || href.startsWith("mailto:")) return;

    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return;

    event.preventDefault();
    preloadNextPage(url);
    document.body.classList.remove("is-intro-loading", "is-holding", "is-intro-revealing");
    document.body.classList.add("is-loaded", "is-leaving");
    window.setTimeout(() => {
      document.body.classList.add("is-holding");
    }, 2000);
    window.setTimeout(() => {
      document.body.classList.add("is-wiping");
    }, 5000);
    window.setTimeout(() => {
      window.location.href = url.href;
    }, 7000);
  });
}

async function setupHeroThree() {
  if (!heroThreeCanvas || reduceMotion) return;

  threeModulePromise ||= import("https://unpkg.com/three@0.160.0/build/three.module.js");

  let THREE;
  try {
    THREE = await threeModulePromise;
  } catch (error) {
    console.warn("Three.js 模組載入失敗，略過 3D Hero。", error);
    return;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({ canvas: heroThreeCanvas, alpha: true, antialias: true });
  const pointer = { x: 0, y: 0 };
  const group = new THREE.Group();

  const yellowMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd21f,
    metalness: 0.45,
    roughness: 0.28
  });
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x151515,
    metalness: 0.25,
    roughness: 0.42
  });
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffd21f, transparent: true, opacity: 0.42 });

  const mainCube = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), yellowMaterial);
  const innerCube = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.92, 0.92), darkMaterial);
  innerCube.position.set(0.45, -0.42, 0.62);
  group.add(mainCube, innerCube);

  for (let index = 0; index < 42; index += 1) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 4.2, (Math.random() - 0.5) * 3),
      new THREE.Vector3((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 4.2, (Math.random() - 0.5) * 3)
    ]);
    scene.add(new THREE.Line(geometry, lineMaterial));
  }

  scene.add(group);
  scene.add(new THREE.AmbientLight(0xffffff, 0.72));
  const keyLight = new THREE.PointLight(0xffd21f, 2.2, 10);
  keyLight.position.set(2.5, 2.4, 3.2);
  scene.add(keyLight);
  camera.position.set(0, 0, 6);

  function resize() {
    const rect = heroThreeCanvas.parentElement.getBoundingClientRect();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  }

  heroThreeCanvas.parentElement.addEventListener("pointermove", (event) => {
    const rect = heroThreeCanvas.parentElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    pointer.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
  });

  function animate(time) {
    group.rotation.x += ((pointer.y * 0.36) - group.rotation.x) * 0.04;
    group.rotation.y += ((pointer.x * 0.48 + time * 0.00035) - group.rotation.y) * 0.04;
    group.position.y = Math.sin(time * 0.0014) * 0.12;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(animate);
}

function setupProjectTilt(cards) {
  if (reduceMotion) return;

  cards.forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      card.classList.add("is-tilting");
      card.style.transform = `perspective(820px) rotateX(${y * -14}deg) rotateY(${x * 16}deg) translateY(-10px) scale(1.015)`;
    });

    card.addEventListener("pointerleave", () => {
      card.classList.remove("is-tilting");
      card.style.transform = "";
    });
  });
}

function setupSkillConstellation() {
  if (!skillConstellation) return;

  const nodes = skillConstellation.querySelectorAll("[data-skill-filter]");
  nodes.forEach((node) => {
    node.addEventListener("click", () => {
      applyProjectFilter(node.dataset.skillFilter);
    });
  });
}

function applyProjectFilter(filter) {
  currentSkillFilter = filter;

  document.querySelectorAll("[data-skill-filter]").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.skillFilter === filter);
  });

  heroCategoryButtons.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.projectFilter === filter);
  });

  renderProjects();
  if (projectsGrid) projectsGrid.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setupHeroCategoryLinks() {
  heroCategoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyProjectFilter(button.dataset.projectFilter);
    });
  });
}

function setupBubblePlayground() {
  if (reduceMotion) return;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const pointer = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    active: false
  };
  const bubbles = [];
  const bubbleCount = Math.min(42, Math.max(18, Math.floor(window.innerWidth / 34)));
  let width = 0;
  let height = 0;
  let deviceScale = 1;

  canvas.className = "bubble-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);

  function resizeCanvas() {
    deviceScale = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * deviceScale);
    canvas.height = Math.floor(height * deviceScale);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
  }

  function createBubble(index) {
    const radius = 8 + Math.random() * 24;
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      radius,
      baseRadius: radius,
      hue: index % 3 === 0 ? "yellow" : "white",
      alpha: 0.08 + Math.random() * 0.16
    };
  }

  function seedBubbles() {
    bubbles.length = 0;
    for (let index = 0; index < bubbleCount; index += 1) {
      bubbles.push(createBubble(index));
    }
  }

  function pushBubble(bubble, force = 1) {
    const dx = bubble.x - pointer.x;
    const dy = bubble.y - pointer.y;
    const distance = Math.hypot(dx, dy);
    const range = 130;

    if (distance > 0 && distance < range) {
      const push = (1 - distance / range) * force;
      bubble.vx += (dx / distance) * push * 1.8;
      bubble.vy += (dy / distance) * push * 1.8;
      bubble.radius = Math.min(bubble.baseRadius * 1.35, bubble.radius + push * 2);
    }
  }

  function animate() {
    context.clearRect(0, 0, width, height);

    bubbles.forEach((bubble, bubbleIndex) => {
      if (pointer.active) {
        pushBubble(bubble, 1);
      }

      bubble.x += bubble.vx;
      bubble.y += bubble.vy;
      bubble.vx *= 0.988;
      bubble.vy *= 0.988;
      bubble.radius += (bubble.baseRadius - bubble.radius) * 0.04;

      if (bubble.x < -bubble.radius) bubble.x = width + bubble.radius;
      if (bubble.x > width + bubble.radius) bubble.x = -bubble.radius;
      if (bubble.y < -bubble.radius) bubble.y = height + bubble.radius;
      if (bubble.y > height + bubble.radius) bubble.y = -bubble.radius;

      const gradient = context.createRadialGradient(
        bubble.x - bubble.radius * 0.35,
        bubble.y - bubble.radius * 0.35,
        1,
        bubble.x,
        bubble.y,
        bubble.radius
      );
      const fill = bubble.hue === "yellow" ? "255, 210, 31" : "255, 253, 242";
      gradient.addColorStop(0, `rgba(${fill}, ${bubble.alpha + 0.16})`);
      gradient.addColorStop(0.68, `rgba(${fill}, ${bubble.alpha})`);
      gradient.addColorStop(1, `rgba(${fill}, 0)`);

      context.beginPath();
      context.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
      context.fillStyle = gradient;
      context.fill();

      for (let index = bubbleIndex + 1; index < bubbles.length; index += 1) {
        const other = bubbles[index];
        const distance = Math.hypot(bubble.x - other.x, bubble.y - other.y);
        if (distance < 118) {
          context.beginPath();
          context.moveTo(bubble.x, bubble.y);
          context.lineTo(other.x, other.y);
          context.strokeStyle = `rgba(255, 210, 31, ${0.08 * (1 - distance / 118)})`;
          context.lineWidth = 1;
          context.stroke();
        }
      }
    });

    requestAnimationFrame(animate);
  }

  function updatePointer(event) {
    pointer.active = true;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  }

  function burstBubbles(event) {
    pointer.active = true;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    bubbles.forEach((bubble) => {
      const dx = bubble.x - pointer.x;
      const dy = bubble.y - pointer.y;
      const distance = Math.hypot(dx, dy);

      if (distance < bubble.radius + 56) {
        bubble.radius = Math.max(3, bubble.radius * 0.24);
        bubble.alpha = Math.min(0.32, bubble.alpha + 0.08);
      }

      pushBubble(bubble, 3.2);
    });
  }

  window.addEventListener("resize", () => {
    resizeCanvas();
    seedBubbles();
  });
  window.addEventListener("pointermove", updatePointer, { passive: true });
  window.addEventListener("pointerdown", burstBubbles, { passive: true });
  window.addEventListener("pointerleave", () => {
    pointer.active = false;
  });

  resizeCanvas();
  seedBubbles();
  animate();
}

function resetForm() {
  if (!projectForm) return;

  projectForm.reset();
  projectForm.elements.id.value = "";
  if (projectForm.elements.date) {
    projectForm.elements.date.value = new Date().toISOString().slice(0, 10);
  }
  if (projectForm.elements.detail) projectForm.elements.detail.value = "";
  if (projectForm.elements.role) projectForm.elements.role.value = "";
  if (projectForm.elements.tools) projectForm.elements.tools.value = "";
  if (formTitle) formTitle.textContent = "新增作品";
  if (submitProject) submitProject.textContent = "加入作品";
  if (cancelEdit) cancelEdit.hidden = true;
}

function getFormProject() {
  const formData = new FormData(projectForm);
  const existingId = formData.get("id");

  return {
    id: existingId || createId(),
    title: formData.get("title").trim(),
    type: formData.get("type"),
    category: formData.get("category").trim(),
    date: formData.get("date"),
    description: formData.get("description").trim(),
    detail: formData.get("detail")?.trim() || formData.get("description").trim(),
    role: formData.get("role")?.trim() || "作品製作",
    tools: formData.get("tools")?.trim() || "未提供",
    link: formData.get("link").trim(),
    image: formData.get("image").trim()
  };
}

function upsertProject(project) {
  const savedProjects = getSavedProjects();
  const existingIndex = savedProjects.findIndex((item) => item.id === project.id);

  if (existingIndex >= 0) {
    savedProjects[existingIndex] = project;
  } else {
    savedProjects.unshift(project);
  }

  setSavedProjects(savedProjects);
}
  
async function syncProjectToCloud(project, action = "upsert") {
  const response = await fetch(GAS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain" 
    },
    body: JSON.stringify({ ...project, action })
  });

  if (!response.ok) {
    throw new Error(`雲端伺服器回應錯誤碼: ${response.status}`);
  }
  
  return response;
}

async function loadCloudProjects() {
  const response = await fetch(`${GAS_API_URL}?action=list&t=${Date.now()}`);
  if (!response.ok) throw new Error(`無法取得雲端資料：${response.status}`);
  cloudProjects = await response.json();
  return cloudProjects;
}

function editProject(project) {
  if (!projectForm) return;

  projectForm.elements.id.value = project.id;
  projectForm.elements.title.value = project.title;
  projectForm.elements.type.value = project.type;
  projectForm.elements.category.value = project.category;
  projectForm.elements.date.value = project.date;
  projectForm.elements.description.value = project.description;
  if (projectForm.elements.detail) projectForm.elements.detail.value = project.detail;
  if (projectForm.elements.role) projectForm.elements.role.value = project.role;
  if (projectForm.elements.tools) projectForm.elements.tools.value = project.tools;
  projectForm.elements.link.value = project.link || "";
  projectForm.elements.image.value = project.image || "";

  if (formTitle) formTitle.textContent = "編輯作品";
  if (submitProject) submitProject.textContent = "儲存修改";
  if (cancelEdit) cancelEdit.hidden = false;

  document.querySelector("#project-editor").scrollIntoView({ behavior: "smooth" });
}

async function deleteProject(id) {
  const project = getAllProjects().find((item) => item.id === id);
  if (!project) return;

  const confirmed = window.confirm(`確定要刪除「${project.title}」嗎？`);
  if (!confirmed) return;

  try {
    await syncProjectToCloud({ id }, "delete");
    localStorage.removeItem(storageKey);
    cloudProjects = cloudProjects.filter((item) => normalizeProject(item, 0, true).id !== id);

    try {
      await loadCloudProjects();
    } catch (reloadError) {
      console.warn("刪除已送出，但雲端資料尚未更新:", reloadError);
    }

    renderProjects();
    resetForm();
    alert("刪除請求已送出。若畫面尚未立即更新，請等 1~2 分鐘後重新整理。");
  } catch (error) {
    console.error("刪除雲端作品失敗:", error);
    alert("刪除失敗，請確認 Google Apps Script 已更新為支援 delete action 的版本。");
  }
}

if (projectForm) {
  projectForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const project = getFormProject();
    const originalButtonText = submitProject ? submitProject.textContent : "加入作品";

    if (submitProject) {
      submitProject.disabled = true;
      submitProject.textContent = "同步到雲端中...";
    }

    try {
      await syncProjectToCloud(project);
      localStorage.removeItem(storageKey);
      alert("已送出到雲端資料表。若公開頁尚未立即更新，請等 1~2 分鐘後重新整理。");

      try {
        await loadCloudProjects();
      } catch (reloadError) {
        console.warn("作品已送出，但雲端資料尚未更新:", reloadError);
      }

      renderProjects();
      resetForm();

      if (projectsGrid) {
        projectsGrid.scrollIntoView({ behavior: "smooth" });
      }
    } catch (error) {
      console.error("同步至雲端失敗:", error);
      upsertProject(project);
      renderProjects();
      alert("雲端同步失敗，作品暫存在這台瀏覽器。請確認 Google Apps Script 部署與權限。");
    } finally {
      if (submitProject) {
        submitProject.disabled = false;
        submitProject.textContent = originalButtonText;
      }
    }
  });
}

if (cancelEdit) {
  cancelEdit.addEventListener("click", resetForm);
}

if (clearSavedProjects) {
  clearSavedProjects.addEventListener("click", () => {
    localStorage.removeItem(storageKey);
    renderProjects();
    resetForm();
  });
}

sortButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentSort = button.dataset.sort;
    updateControlButtons(sortButtons, currentSort, "sort");
    renderProjects();
  });
});

viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentView = button.dataset.view;
    updateControlButtons(viewButtons, currentView, "view");
    renderProjects();
  });
});

if (navToggle && navLinks) {
  const closeMobileNav = () => {
    navLinks.classList.remove("is-open");
    navToggle.classList.remove("is-active");
    navToggle.setAttribute("aria-expanded", "false");
  };

  navToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("is-open");
    navToggle.classList.toggle("is-active", isOpen);
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) return;

    link.classList.add("is-tapped");
    window.setTimeout(() => {
      link.classList.remove("is-tapped");
      closeMobileNav();
    }, 140);
  });
}

observeReveals(document.querySelectorAll(".section, .admin-stats, .info-block, .about-card, .project-form"));
updateControlButtons(sortButtons, currentSort, "sort");
updateControlButtons(viewButtons, currentView, "view");
setupPageTransitions();
setupHeroThree();
setupSkillConstellation();
setupHeroCategoryLinks();
resetForm();
updateHeaderState();
window.addEventListener("scroll", updateHeaderState, { passive: true });
// setupBubblePlayground();
// renderProjects();
// renderDetailPage();

async function initPortfolio() {
  try {
    if (projectsGrid) projectsGrid.innerHTML = '<p class="empty-message">作品載入中...</p>';

    await loadCloudProjects();
    console.log("雲端作品載入成功！共 " + cloudProjects.length + " 件作品。");
    
  } catch (error) {
    console.error("讀取 Google Sheet 失敗，啟用備用本地資料:", error);
    cloudProjects = typeof defaultProjects !== 'undefined' ? defaultProjects : [];
  } finally {
    setupBubblePlayground();
    renderProjects();
    renderDetailPage();
  }
}

// 執行初始化
initPortfolio();
