import { type VariantProps, cva } from 'class-variance-authority'

export { default as Button } from './Button.vue'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-display font-semibold ' +
  'transition-colors duration-200 ease-bounce active:opacity-80 ' +
  'disabled:pointer-events-none disabled:opacity-40 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:pointer-events-none ' +
  '[&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-border bg-transparent hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'rounded-none text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-12 px-6 py-3 [&_svg]:size-4',
        sm: 'h-10 px-4 text-sm [&_svg]:size-4',
        lg: 'h-14 px-8 text-base [&_svg]:size-5',
        icon: 'h-10 w-10 rounded-full [&_svg]:size-4',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
