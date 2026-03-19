import { expect } from 'chai'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { en as locale } from '@/locales/en'
import About from '@/modules/about/views/About.vue'

const createWrapper = () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/about', name: 'about', component: About },
    ],
  })
  return mount(About, {
    global: {
      plugins: [router],
      stubs: { RouterLink: { template: '<a><slot /></a>' } },
    },
  })
}

describe('About.vue', () => {
  it('mounts successfully', () => {
    expect(createWrapper().exists()).to.be.true
  })

  it('root element has data-test="about"', () => {
    expect(createWrapper().find('[data-test="about"]').exists()).to.be.true
  })

  it('renders about-grid', () => {
    expect(createWrapper().find('[data-test="about-grid"]').exists()).to.be.true
  })

  it('renders about-image and about-content', () => {
    const w = createWrapper()
    expect(w.find('[data-test="about-image"]').exists()).to.be.true
    expect(w.find('[data-test="about-content"]').exists()).to.be.true
  })

  it('renders image with alt text', () => {
    const img = createWrapper().find('[data-test="about-img"]')
    expect(img.exists()).to.be.true
    expect(img.attributes('alt')).to.have.length.above(0)
  })

  it('badge matches locale', () => {
    expect(createWrapper().find('[data-test="badge"]').text()).to.equal(locale.about.badge)
  })

  it('eyebrow matches locale', () => {
    expect(createWrapper().find('[data-test="eyebrow"]').text()).to.equal(locale.about.eyebrow)
  })

  it('title matches locale', () => {
    expect(createWrapper().find('[data-test="title"]').text()).to.equal(locale.about.title)
  })

  it('description matches locale', () => {
    expect(createWrapper().find('[data-test="description"]').text()).to.equal(locale.about.description)
  })

  it('stack label matches locale', () => {
    expect(createWrapper().find('[data-test="stack-label"]').text()).to.equal(locale.about.stackLabel)
  })

  it('renders all stack chips from locale', () => {
    const chips = createWrapper().findAll('[data-test="chip"]')
    expect(chips).to.have.length(locale.about.stack.length)
    chips.forEach((chip, i) => {
      expect(chip.text()).to.equal(locale.about.stack[i])
    })
  })

  it('CTA text matches locale', () => {
    expect(createWrapper().find('[data-test="cta"]').text()).to.equal(locale.about.cta)
  })

  it('renders glow decorator', () => {
    expect(createWrapper().find('.glow').exists()).to.be.true
  })
})
