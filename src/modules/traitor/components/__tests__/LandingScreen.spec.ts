import { expect } from 'chai'
import { mount } from '@vue/test-utils'
import { en as locale } from '@/locales/en'
import LandingScreen from '@/modules/traitor/components/LandingScreen.vue'

const createWrapper = (props: Partial<InstanceType<typeof LandingScreen>['$props']> = {}) => {
  return mount(LandingScreen, {
    props: {
      pendingAction: null,
      isSlowConnection: false,
      categories: ['Classic', 'Party'],
      ...props,
    },
  })
}

describe('Traitor / LandingScreen.vue', () => {
  it('mounts successfully', () => {
    expect(createWrapper().exists()).to.be.true
  })

  it('defaults to the Create Room tab', () => {
    expect(createWrapper().text()).to.include(locale.traitor.landing.createHeading)
  })

  it('lands on the Join tab when an initial room code is provided', () => {
    expect(createWrapper({ initialRoomCode: 'ABC123' }).text()).to.include(locale.traitor.landing.joinHeading)
  })

  it('switches to the Join form when the Join Room tab is clicked', async () => {
    const wrapper = createWrapper()
    const joinTab = wrapper.findAll('button').find((b) => b.text() === locale.traitor.landing.joinTab)
    await joinTab?.trigger('click')
    expect(wrapper.text()).to.include(locale.traitor.landing.joinHeading)
  })

  it('renders the question categories as options', () => {
    expect(createWrapper().text()).to.include('Classic')
  })

  it('emits create with the chosen settings', async () => {
    const wrapper = createWrapper()
    await wrapper.find('input').setValue('Host')
    // Both the tab and the submit button read "Create Room" — the submit is the last.
    const createButtons = wrapper.findAll('button').filter((b) => b.text().includes(locale.traitor.landing.createButton))
    await createButtons[createButtons.length - 1].trigger('click')
    const events = wrapper.emitted('create')
    expect(events).to.not.be.undefined
    expect((events![0][0] as { totalRounds: number }).totalRounds).to.equal(5)
  })

  it('renders the "Made by RK" footer credit', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).to.include(locale.traitor.footer.madeBy)
    expect(wrapper.text()).to.include(locale.traitor.footer.name)
  })
})
