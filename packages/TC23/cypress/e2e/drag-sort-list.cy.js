/// <reference types="cypress" />

describe('拖拽排序列表', () => {
  beforeEach(() => {
    cy.visit('./drag-sort-list.html')
  })

  it('页面初始加载成功', () => {
    cy.get('h1').should('contain', '拖拽排序列表')
    cy.get('#sortableList').should('exist')
  })

  it('初始列表应有5个项目', () => {
    cy.get('.list-item').should('have.length', 5)
  })

  it('验证初始数据顺序', () => {
    const expectedItems = [
      '学习 JavaScript',
      '掌握 SortableJS',
      '完成项目开发',
      '代码审查',
      '部署上线'
    ]

    cy.get('.list-item .item-content').each(($el, index) => {
      expect($el.text().trim()).to.equal(expectedItems[index])
    })

    cy.window().then((win) => {
      expect(win.items).to.deep.equal(expectedItems)
    })
  })

  it('拖拽第一个项目到第三个位置', () => {
    cy.window().then((win) => {
      const originalItems = [...win.items]
      expect(originalItems[0]).to.equal('学习 JavaScript')
      expect(originalItems[2]).to.equal('完成项目开发')
    })

    cy.get('.list-item').first().as('firstItem')
    cy.get('.list-item').eq(2).as('targetItem')

    cy.get('@firstItem').then($first => {
      const firstRect = $first[0].getBoundingClientRect()
      const firstX = firstRect.left + firstRect.width / 2
      const firstY = firstRect.top + firstRect.height / 2

      cy.get('@targetItem').then($target => {
        const targetRect = $target[0].getBoundingClientRect()
        const targetX = targetRect.left + targetRect.width / 2
        const targetY = targetRect.top + targetRect.height / 2 + targetRect.height

        cy.get('@firstItem')
          .trigger('mousedown', { which: 1, pageX: firstX, pageY: firstY, force: true })
          .trigger('mousemove', { pageX: targetX, pageY: targetY, force: true })
          .wait(100)
          .trigger('mousemove', { pageX: targetX, pageY: targetY, force: true })
          .wait(100)
          .trigger('mouseup', { force: true })

        cy.wait(300)

        cy.get('.list-item .item-content').eq(1).should('contain', '学习 JavaScript')

        cy.window().then((win) => {
          expect(win.items[1]).to.equal('学习 JavaScript')
          expect(win.items[0]).to.equal('掌握 SortableJS')
        })
      })
    })
  })

  it('拖拽最后一个项目到第一个位置', () => {
    cy.get('.list-item').last().as('lastItem')
    cy.get('.list-item').first().as('firstItem')

    cy.get('@lastItem').then($last => {
      const lastRect = $last[0].getBoundingClientRect()
      const lastX = lastRect.left + lastRect.width / 2
      const lastY = lastRect.top + lastRect.height / 2

      cy.get('@firstItem').then($first => {
        const firstRect = $first[0].getBoundingClientRect()
        const firstX = firstRect.left + firstRect.width / 2
        const firstY = firstRect.top - firstRect.height

        cy.get('@lastItem')
          .trigger('mousedown', { which: 1, pageX: lastX, pageY: lastY, force: true })
          .trigger('mousemove', { pageX: firstX, pageY: firstY, force: true })
          .wait(100)
          .trigger('mousemove', { pageX: firstX, pageY: firstY, force: true })
          .wait(100)
          .trigger('mouseup', { force: true })

        cy.wait(300)

        cy.get('.list-item .item-content').first().should('contain', '部署上线')

        cy.window().then((win) => {
          expect(win.items[0]).to.equal('部署上线')
        })
      })
    })
  })

  it('验证 DOM 顺序和数据数组顺序一致', () => {
    cy.get('.list-item').eq(1).as('dragItem')
    cy.get('.list-item').eq(3).as('dropTarget')

    cy.get('@dragItem').then($drag => {
      const dragRect = $drag[0].getBoundingClientRect()
      const dragX = dragRect.left + dragRect.width / 2
      const dragY = dragRect.top + dragRect.height / 2

      cy.get('@dropTarget').then($drop => {
        const dropRect = $drop[0].getBoundingClientRect()
        const dropX = dropRect.left + dropRect.width / 2
        const dropY = dropRect.top + dropRect.height / 2 + dropRect.height

        cy.get('@dragItem')
          .trigger('mousedown', { which: 1, pageX: dragX, pageY: dragY, force: true })
          .trigger('mousemove', { pageX: dropX, pageY: dropY, force: true })
          .wait(150)
          .trigger('mouseup', { force: true })

        cy.wait(300)

        cy.get('.list-item .item-content').then($items => {
          const domOrder = $items.map((_, el) => el.textContent.trim()).get()

          cy.window().then((win) => {
            expect(win.items).to.deep.equal(domOrder)
          })
        })
      })
    })
  })

  it('添加新项目后数据同步', () => {
    cy.get('#newItemInput').type('新测试项目{enter}')
    cy.get('.list-item').should('have.length', 6)
    cy.get('.list-item .item-content').last().should('contain', '新测试项目')

    cy.window().then((win) => {
      expect(win.items).to.include('新测试项目')
      expect(win.items[5]).to.equal('新测试项目')
    })
  })

  it('删除项目后数据同步', () => {
    cy.get('.delete-btn').first().click()
    cy.get('.list-item').should('have.length', 4)

    cy.window().then((win) => {
      expect(win.items).to.not.include('学习 JavaScript')
      expect(win.items.length).to.equal(4)
    })
  })
})
