import { type VariantProps, cva } from 'class-variance-authority'

export { default as Button } from './Button.vue'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-display font-semibold ' +
  'transition-all duration-200 ease-bounce hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ' +
  'disabled:pointer-events-none disabled:opacity-40 disabled:hover:translate-y-0 disabled:active:scale-100 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:pointer-events-none ' +
  '[&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-pop hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline: 'border-2 border-border bg-transparent shadow-sm hover:border-foreground/40 hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'rounded-none text-primary underline-offset-4 hover:underline hover:translate-y-0',
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
