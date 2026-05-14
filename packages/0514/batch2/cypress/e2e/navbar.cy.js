/// <reference types="cypress" />

describe('响应式导航栏测试', () => {
  const pagePath = 'navbar.html'

  beforeEach(() => {
    cy.visit(pagePath)
  })

  describe('桌面端视图 (> 768px)', () => {
    beforeEach(() => {
      cy.viewport(1280, 720)
    })

    it('应该显示横向菜单并隐藏汉堡按钮', () => {
      cy.get('.nav-menu').should('be.visible')
      cy.get('.hamburger').should('not.be.visible')
    })

    it('应该显示所有菜单项', () => {
      cy.get('.nav-link').contains('首页').should('be.visible')
      cy.get('.nav-link').contains('关于').should('be.visible')
      cy.get('.nav-link').contains('服务').should('be.visible')
      cy.get('.nav-link').contains('联系').should('be.visible')
    })

    it('首页链接应该默认高亮', () => {
      cy.get('.nav-link').contains('首页').should('have.class', 'active')
    })
  })

  describe('移动端视图 (<= 768px)', () => {
    beforeEach(() => {
      cy.viewport(768, 1024)
    })

    it('应该显示汉堡按钮并隐藏横向菜单', () => {
      cy.get('.hamburger').should('be.visible')
      cy.get('.nav-menu').should('not.be.visible')
    })

    it('点击汉堡按钮应该打开侧边栏', () => {
      cy.get('.hamburger').click()
      cy.get('.nav-menu').should('have.class', 'active')
      cy.get('.sidebar-overlay').should('have.class', 'active')
      cy.get('.nav-menu').should('be.visible')
    })

    it('打开侧边栏后应该锁定页面滚动', () => {
      cy.get('.hamburger').click()
      cy.get('body').should('have.css', 'overflow', 'hidden')
    })

    it('点击遮罩层应该关闭侧边栏', () => {
      cy.get('.hamburger').click()
      cy.get('.sidebar-overlay').click({ force: true })
      cy.get('.nav-menu').should('not.have.class', 'active')
      cy.get('.sidebar-overlay').should('not.have.class', 'active')
    })

    it('关闭侧边栏后应该恢复页面滚动', () => {
      cy.get('.hamburger').click()
      cy.get('.sidebar-overlay').click({ force: true })
      cy.get('body').should('have.css', 'overflow', 'visible')
    })

    it('点击侧边栏链接应该跳转并高亮该链接', () => {
      cy.get('.hamburger').click()
      cy.get('.nav-link').contains('关于').click()
      cy.get('.nav-link').contains('关于').should('have.class', 'active')
    })

    it('点击侧边栏链接后应该自动关闭侧边栏', () => {
      cy.get('.hamburger').click()
      cy.get('.nav-link').contains('联系').click()
      cy.get('.nav-menu').should('not.have.class', 'active')
      cy.get('.sidebar-overlay').should('not.have.class', 'active')
    })

    it('依次点击所有链接都应该正确高亮', () => {
      const links = ['首页', '关于', '服务', '联系']
      links.forEach((linkText, index) => {
        if (index > 0) {
          cy.get('.hamburger').click()
        }
        cy.get('.nav-link').contains(linkText).click()
        cy.get('.nav-link').contains(linkText).should('have.class', 'active')
      })
    })
  })

  describe('窗口大小切换', () => {
    it('从桌面调整到移动端应该切换到汉堡菜单', () => {
      cy.viewport(1280, 720)
      cy.get('.hamburger').should('not.be.visible')
      cy.viewport(768, 1024)
      cy.get('.hamburger').should('be.visible')
    })

    it('从移动端调整到桌面应该切换回横向菜单', () => {
      cy.viewport(768, 1024)
      cy.get('.nav-menu').should('not.be.visible')
      cy.viewport(1280, 720)
      cy.get('.nav-menu').should('be.visible')
    })
  })
})
