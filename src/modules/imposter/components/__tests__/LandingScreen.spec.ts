import { expect } from 'chai'
import { mount } from '@vue/test-utils'
import { en as locale } from '@/locales/en'
import LandingScreen from '@/modules/imposter/components/LandingScreen.vue'

const createWrapper = (props: Partial<InstanceType<typeof LandingScreen>['$props']> = {}) => {
  return mount(LandingScreen, {
    props: {
      pendingAction: null,
      isSlowConnection: false,
      ...props,
    },
  })
}

describe('LandingScreen.vue', () => {
  it('mounts successfully', () => {
    expect(createWrapper().exists()).to.be.true
  })

  it('defaults to the Create Room tab', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).to.include(locale.imposter.landing.createHeading)
  })

  it('lands on the Join tab when an initial room code is provided', () => {
    const wrapper = createWrapper({ initialRoomCode: 'ABC123' })
    expect(wrapper.text()).to.include(locale.imposter.landing.joinHeading)
  })

  it('switches to the Join form when the Join Room tab is clicked', async () => {
    const wrapper = createWrapper()
    const buttons = wrapper.findAll('button')
    const joinTab = buttons.find((b) => b.text() === locale.imposter.landing.joinTab)
    await joinTab?.trigger('click')
    expect(wrapper.text()).to.include(locale.imposter.landing.joinHeading)
  })

  it('renders the "Made by RK" footer credit', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).to.include(locale.imposter.landing.footerMadeBy)
    expect(wrapper.text()).to.include(locale.imposter.landing.footerName)
  })

  it('easter egg: clicking the footer name reveals the real name, and clicking again reverts it', async () => {
    const wrapper = createWrapper()
    const buttons = wrapper.findAll('button')
    const credit = buttons.find((b) => b.text() === locale.imposter.landing.footerName)
    expect(credit).to.not.be.undefined

    await credit!.trigger('click')
    expect(wrapper.text()).to.include(locale.imposter.landing.footerRealName)
    expect(wrapper.text()).to.not.include(locale.imposter.landing.footerName)

    await wrapper.find('button[aria-label*="Nishan"]').trigger('click')
    expect(wrapper.text()).to.include(locale.imposter.landing.footerName)
  })
})
