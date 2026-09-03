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

  it('renders the about content container', () => {
    expect(createWrapper().find('[data-test="about-content"]').exists()).to.be.true
  })

  it('contact title matches locale', () => {
    expect(createWrapper().find('.about-title').text()).to.equal(locale.about.contactTitle)
  })

  it('contact subtitle matches locale', () => {
    expect(createWrapper().find('.about-subtitle').text()).to.equal(locale.about.contactSubtitle)
  })

  it('renders the subject and message fields', () => {
    const w = createWrapper()
    expect(w.find('#subject').exists()).to.be.true
    expect(w.find('#message').exists()).to.be.true
  })

  it('field labels match locale', () => {
    const w = createWrapper()
    expect(w.find('label[for="subject"]').text()).to.equal(locale.about.contactForm.subjectLabel)
    expect(w.find('label[for="message"]').text()).to.equal(
      locale.about.contactForm.descriptionLabel,
    )
  })

  it('submit button text matches locale', () => {
    expect(createWrapper().find('.btn-submit').text()).to.equal(locale.about.contactForm.submitBtn)
  })

  it('back link text matches locale', () => {
    expect(createWrapper().find('.btn-back').text()).to.equal(locale.about.backBtn)
  })

  it('name toggle starts on the alternate name and flips on click', async () => {
    const w = createWrapper()
    const toggle = w.find('.name-toggle')
    expect(toggle.text()).to.equal(locale.about.nameAlternate)
  })

  it('renders a decorative blob', () => {
    expect(createWrapper().find('.about-blob').exists()).to.be.true
  })
})
