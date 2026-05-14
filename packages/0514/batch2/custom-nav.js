class CustomNav extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._menuItems = [];
    this._activeItem = 'home';
  }

  static get observedAttributes() {
    return ['items', 'active', 'logo'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      if (name === 'items') {
        try {
          this._menuItems = JSON.parse(newValue);
        } catch (e) {
          this._menuItems = [];
        }
      }
      if (name === 'active') {
        this._activeItem = newValue;
      }
      if (name === 'logo') {
        this._logo = newValue;
      }
      this.render();
      this.attachEventListeners();
    }
  }

  connectedCallback() {
    this.render();
    this.attachEventListeners();
  }

  get items() {
    return this.getAttribute('items');
  }

  set items(value) {
    this.setAttribute('items', value);
  }

  get active() {
    return this.getAttribute('active');
  }

  set active(value) {
    this.setAttribute('active', value);
  }

  get logo() {
    return this.getAttribute('logo') || 'Logo';
  }

  set logo(value) {
    this.setAttribute('logo', value);
  }

  closeSidebar() {
    const hamburger = this.shadowRoot.querySelector('.hamburger');
    const navMenu = this.shadowRoot.querySelector('.nav-menu');
    const sidebarOverlay = this.shadowRoot.querySelector('.sidebar-overlay');
    
    hamburger.classList.remove('active');
    navMenu.classList.remove('active');
    sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
    this.closeAllDropdowns();
  }

  openSidebar() {
    const hamburger = this.shadowRoot.querySelector('.hamburger');
    const navMenu = this.shadowRoot.querySelector('.nav-menu');
    const sidebarOverlay = this.shadowRoot.querySelector('.sidebar-overlay');
    
    hamburger.classList.add('active');
    navMenu.classList.add('active');
    sidebarOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  closeAllDropdowns() {
    const dropdownToggles = this.shadowRoot.querySelectorAll('.dropdown-toggle');
    const dropdownMenus = this.shadowRoot.querySelectorAll('.dropdown-menu');
    
    dropdownToggles.forEach(toggle => {
      toggle.parentElement.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
    dropdownMenus.forEach(menu => {
      menu.classList.remove('show');
    });
  }

  toggleDropdown(dropdownToggle) {
    const dropdown = dropdownToggle.parentElement;
    const dropdownMenu = dropdown.querySelector('.dropdown-menu');
    const isOpen = dropdown.classList.contains('open');

    this.closeAllDropdowns();

    if (!isOpen) {
      dropdown.classList.add('open');
      dropdownToggle.setAttribute('aria-expanded', 'true');
      dropdownMenu.classList.add('show');
    }
  }

  dispatchNavClick(item, isDropdown = false, parentItem = null) {
    const event = new CustomEvent('nav-click', {
      bubbles: true,
      composed: true,
      detail: {
        item,
        isDropdown,
        parentItem,
        timestamp: new Date().toISOString()
      }
    });
    this.dispatchEvent(event);
  }

  dispatchMenuToggle(isOpen) {
    const event = new CustomEvent('menu-toggle', {
      bubbles: true,
      composed: true,
      detail: {
        isOpen,
        timestamp: new Date().toISOString()
      }
    });
    this.dispatchEvent(event);
  }

  attachEventListeners() {
    const hamburger = this.shadowRoot.querySelector('.hamburger');
    const navMenu = this.shadowRoot.querySelector('.nav-menu');
    const sidebarOverlay = this.shadowRoot.querySelector('.sidebar-overlay');
    const navLinks = this.shadowRoot.querySelectorAll('.nav-link');
    const dropdownToggles = this.shadowRoot.querySelectorAll('.dropdown-toggle');
    const dropdownLinks = this.shadowRoot.querySelectorAll('.dropdown-link');

    if (hamburger) {
      hamburger.addEventListener('click', () => {
        if (navMenu.classList.contains('active')) {
          this.closeSidebar();
          this.dispatchMenuToggle(false);
        } else {
          this.openSidebar();
          this.dispatchMenuToggle(true);
        }
      });
    }

    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', () => {
        this.closeSidebar();
        this.dispatchMenuToggle(false);
      });
    }

    dropdownToggles.forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
          e.preventDefault();
          this.toggleDropdown(toggle);
        }
      });

      toggle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (window.innerWidth > 768) {
            this.toggleDropdown(toggle);
            setTimeout(() => {
              const firstLink = toggle.parentElement.querySelector('.dropdown-link');
              if (firstLink) firstLink.focus();
            }, 100);
          } else {
            this.toggleDropdown(toggle);
          }
        }
        if (e.key === 'Escape') {
          this.closeAllDropdowns();
          toggle.focus();
        }
      });
    });

    dropdownLinks.forEach((link, index) => {
      link.addEventListener('click', () => {
        const parentToggle = link.closest('.dropdown').querySelector('.dropdown-toggle');
        const parentId = parentToggle.dataset.page;
        const itemId = link.getAttribute('href')?.replace('#', '');
        this.dispatchNavClick(itemId, true, parentId);
        this.closeSidebar();
      });

      link.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeAllDropdowns();
          const toggle = link.closest('.dropdown').querySelector('.dropdown-toggle');
          toggle.focus();
        }
        if (e.key === 'ArrowDown' && index < dropdownLinks.length - 1) {
          e.preventDefault();
          dropdownLinks[index + 1].focus();
        }
        if (e.key === 'ArrowUp' && index > 0) {
          e.preventDefault();
          dropdownLinks[index - 1].focus();
        }
      });
    });

    this.shadowRoot.addEventListener('click', (e) => {
      if (!e.target.closest('.dropdown')) {
        this.closeAllDropdowns();
      }
    });

    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        if (!link.classList.contains('dropdown-toggle')) {
          const itemId = link.getAttribute('href')?.replace('#', '');
          this._activeItem = itemId;
          this.dispatchNavClick(itemId);
          this.closeSidebar();
        }
      });
    });
  }

  renderMenuItems() {
    return this._menuItems.map(item => {
      if (item.children && item.children.length > 0) {
        const childrenHtml = item.children.map(child => `
          <li><a href="#${child.id}" class="dropdown-link">${child.label}</a></li>
        `).join('');

        return `
          <li class="nav-item dropdown">
            <a href="#${item.id}" class="nav-link dropdown-toggle ${this._activeItem === item.id ? 'active' : ''}" 
               data-page="${item.id}" aria-expanded="false">
              ${item.label}
              <span class="dropdown-arrow">▼</span>
            </a>
            <ul class="dropdown-menu">
              ${childrenHtml}
            </ul>
          </li>
        `;
      } else {
        return `
          <li class="nav-item">
            <a href="#${item.id}" class="nav-link ${this._activeItem === item.id ? 'active' : ''}" 
               data-page="${item.id}">${item.label}</a>
          </li>
        `;
      }
    }).join('');
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
        }

        .navbar {
          background-color: #2c3e50;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          position: fixed;
          width: 100%;
          top: 0;
          left: 0;
          z-index: 1000;
        }

        .nav-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          height: 60px;
        }

        .logo {
          color: white;
          font-size: 1.5rem;
          font-weight: bold;
          text-decoration: none;
        }

        .nav-menu {
          display: flex;
          list-style: none;
          gap: 5px;
          margin: 0;
          padding: 0;
        }

        .nav-item {
          position: relative;
        }

        .nav-link {
          color: #ecf0f1;
          text-decoration: none;
          padding: 10px 18px;
          display: block;
          transition: all 0.3s ease;
          border-radius: 4px;
          font-weight: 500;
        }

        .nav-link:hover,
        .nav-link:focus {
          background-color: #34495e;
          color: #3498db;
          outline: none;
        }

        .nav-link.active {
          background-color: #3498db;
          color: white;
        }

        .dropdown-arrow {
          display: inline-block;
          margin-left: 5px;
          font-size: 0.7rem;
          transition: transform 0.3s ease;
        }

        .dropdown {
          position: relative;
        }

        .dropdown-menu {
          position: absolute;
          top: 100%;
          left: 0;
          min-width: 180px;
          background-color: #34495e;
          list-style: none;
          border-radius: 4px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          opacity: 0;
          visibility: hidden;
          transform: translateY(-10px);
          transition: all 0.3s ease;
          padding: 8px 0;
          z-index: 1001;
          margin: 0;
        }

        .dropdown:hover .dropdown-menu,
        .dropdown-menu.show {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }

        .dropdown.open .dropdown-arrow {
          transform: rotate(180deg);
        }

        .dropdown-link {
          color: #ecf0f1;
          text-decoration: none;
          padding: 10px 20px;
          display: block;
          transition: all 0.3s ease;
          white-space: nowrap;
        }

        .dropdown-link:hover,
        .dropdown-link:focus {
          background-color: #3498db;
          outline: none;
        }

        .hamburger {
          display: none;
          flex-direction: column;
          cursor: pointer;
          padding: 5px;
          z-index: 1001;
          background: none;
          border: none;
        }

        .hamburger span {
          width: 25px;
          height: 3px;
          background-color: white;
          margin: 3px 0;
          transition: all 0.3s ease;
          border-radius: 2px;
          display: block;
        }

        .hamburger.active span:nth-child(1) {
          transform: rotate(45deg) translate(5px, 5px);
        }

        .hamburger.active span:nth-child(2) {
          opacity: 0;
        }

        .hamburger.active span:nth-child(3) {
          transform: rotate(-45deg) translate(7px, -7px);
        }

        .sidebar-overlay {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
          z-index: 999;
        }

        .sidebar-overlay.active {
          display: block;
        }

        @media screen and (max-width: 768px) {
          .nav-menu {
            position: fixed;
            top: 0;
            right: -280px;
            width: 280px;
            height: 100vh;
            background-color: #2c3e50;
            flex-direction: column;
            padding: 80px 20px 20px;
            transition: right 0.3s ease;
            z-index: 1000;
            box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
            gap: 0;
            overflow-y: auto;
          }

          .nav-menu.active {
            right: 0;
          }

          .nav-link {
            padding: 15px 20px;
            border-radius: 4px;
            margin-bottom: 5px;
          }

          .dropdown {
            display: flex;
            flex-direction: column;
          }

          .dropdown-menu {
            position: static;
            opacity: 1;
            visibility: visible;
            transform: none;
            box-shadow: none;
            background-color: rgba(52, 73, 94, 0.8);
            max-height: 0;
            overflow: hidden;
            padding: 0;
            transition: max-height 0.3s ease, padding 0.3s ease;
          }

          .dropdown-menu.show {
            max-height: 200px;
            padding: 8px 0;
          }

          .dropdown-link {
            padding-left: 40px;
          }

          .hamburger {
            display: flex;
          }
        }
      </style>

      <nav class="navbar">
        <div class="nav-container">
          <span class="logo">${this.logo}</span>
          <button class="hamburger" aria-label="Toggle menu">
            <span></span>
            <span></span>
            <span></span>
          </button>
          <ul class="nav-menu">
            ${this.renderMenuItems()}
          </ul>
        </div>
      </nav>
      <div class="sidebar-overlay"></div>
    `;
  }
}

customElements.define('custom-nav', CustomNav);
