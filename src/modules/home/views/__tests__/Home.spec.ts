import { expect } from 'chai'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { en as locale } from '@/locales/en'
import Home from '@/modules/home/views/Home.vue'

const createWrapper = () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: Home },
      { path: '/about', name: 'about', component: { template: '<div />' } },
    ],
  })
  return mount(Home, {
    global: {
      plugins: [router],
      stubs: { RouterLink: { template: '<a><slot /></a>' } },
    },
  })
}

describe('Home.vue', () => {
  it('mounts successfully', () => {
    expect(createWrapper().exists()).to.be.true
  })

  it('root element has data-test="home"', () => {
    expect(createWrapper().find('[data-test="home"]').exists()).to.be.true
  })

  it('renders hero section', () => {
    expect(createWrapper().find('[data-test="hero"]').exists()).to.be.true
  })

  it('renders hero-text and hero-visual', () => {
    const w = createWrapper()
    expect(w.find('[data-test="hero-text"]').exists()).to.be.true
    expect(w.find('[data-test="hero-visual"]').exists()).to.be.true
  })

  it('greeting matches locale', () => {
    expect(createWrapper().find('[data-test="greeting"]').text()).to.equal(locale.home.greeting)
  })

  it('name matches locale', () => {
    expect(createWrapper().find('[data-test="name"]').text()).to.equal(locale.home.name)
  })

  it('tagline matches locale', () => {
    expect(createWrapper().find('[data-test="tagline"]').text()).to.equal(locale.home.tagline)
  })

  it('sub line matches locale', () => {
    expect(createWrapper().find('[data-test="sub"]').text()).to.equal(locale.home.sub)
  })

  it('CTA text matches locale', () => {
    expect(createWrapper().find('[data-test="cta"]').text()).to.equal(locale.home.cta)
  })

  it('renders hero image with alt text', () => {
    const img = createWrapper().find('[data-test="hero-img"]')
    expect(img.exists()).to.be.true
    expect(img.attributes('alt')).to.have.length.above(0)
  })

  it('renders two glow decorators', () => {
    const w = createWrapper()
    expect(w.find('.glow-1').exists()).to.be.true
    expect(w.find('.glow-2').exists()).to.be.true
  })
})
