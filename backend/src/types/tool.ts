export interface Tool {
  id: string
  title: string
  description: string
  category: 'Convert' | 'Optimize' | 'Organize' | 'Secure'
  formats: string[]
  popular: boolean
}
