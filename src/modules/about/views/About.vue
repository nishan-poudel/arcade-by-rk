<template>
  <div class="about" data-test="about">
    <div class="about-container">
      <div class="about-header">
        <h1>{{ locale.about.contactTitle }}</h1>
        <p class="about-subtitle">{{ locale.about.contactSubtitle }}</p>
      </div>

      <div class="about-content">
        <form class="contact-form" @submit.prevent="sendMessage">
          <div class="form-group">
            <label for="subject" class="form-label">{{ locale.about.contactForm.subjectLabel }}</label>
            <input
              id="subject"
              v-model="formData.subject"
              type="text"
              class="form-input"
              :placeholder="locale.about.contactForm.subjectPlaceholder"
              required
              :disabled="isSubmitting"
            >
          </div>

          <div class="form-group">
            <label for="message" class="form-label">{{ locale.about.contactForm.descriptionLabel }}</label>
            <textarea
              id="message"
              v-model="formData.message"
              class="form-textarea"
              :placeholder="locale.about.contactForm.descriptionPlaceholder"
              rows="6"
              required
              :disabled="isSubmitting"
            />
          </div>

          <button
            type="submit"
            class="btn btn-submit"
            :disabled="isSubmitting"
          >
            {{ isSubmitting ? locale.about.contactForm.sendingBtn : locale.about.contactForm.submitBtn }}
          </button>

          <div v-if="formMessage.text" :class="['form-message', formMessage.type]">
            {{ formMessage.text }}
          </div>
        </form>

        <RouterLink :to="{ name: 'home' }" class="btn btn-back">
          {{ locale.about.backBtn }}
        </RouterLink>

        <div class="builder-note">
          <p>{{ locale.about.builderNote }}</p>
          <p class="made-by">
            {{ locale.about.madeByLabel }} <button
              :key="displayName"
              class="name-toggle" :class="{ rotating: isRotating }"
              @click="toggleName">
              {{ displayName }}
            </button>.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { en as locale } from '@/locales/en'
import { usePageTitle } from '@/modules/shared/composables/usePageTitle'

usePageTitle('About')

const isRockingKaka = ref(true)
const isRotating = ref(false)
const displayName = computed(() => isRockingKaka.value ? locale.about.nameAlternate : locale.about.nameDefault)

const toggleName = () => {
  isRotating.value = true
  setTimeout(() => {
    isRockingKaka.value = !isRockingKaka.value
    isRotating.value = false
  }, 1200)
}

const formData = ref({
  subject: '',
  message: '',
})

const isSubmitting = ref(false)
const formMessage = ref({
  text: '',
  type: '' as 'success' | 'error',
})

const sendMessage = async () => {
  if (isSubmitting.value) {
    return
  }

  isSubmitting.value = true
  formMessage.value = { text: '', type: 'success' }

  try {
    const response = await fetch(locale.about.contactEmail, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: formData.value.subject,
        message: formData.value.message,
      }),
    })

    if (response.ok) {
      formMessage.value = {
        text: locale.about.contactForm.successMsg,
        type: 'success',
      }
      formData.value = { subject: '', message: '' }
      setTimeout(() => {
        formMessage.value = { text: '', type: 'success' }
      }, 4000)
    } else {
      formMessage.value = {
        text: locale.about.contactForm.errorMsg,
        type: 'error',
      }
    }
  } catch (error) {
    formMessage.value = {
      text: locale.about.contactForm.errorMsg,
      type: 'error',
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped src="./About.scss"></style>
