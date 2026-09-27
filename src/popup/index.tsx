import { createRoot } from 'react-dom/client'

import { Popup } from './Popup'
import styles from './popup.css'

const style = document.createElement('style')
style.textContent = styles
document.head.append(style)

createRoot(document.getElementById('root')!).render(<Popup />)
