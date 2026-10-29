import { QubeCharacter } from './QubeCharacter'

interface CubeLoaderProps {
  text?: string
}

export const CubeLoader = ({ text = 'LOADING PROJECTS' }: CubeLoaderProps) => {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-[420px] py-10">
      <QubeCharacter moment="auto" size={168} caption />
      <h3 className="mt-5 text-xl font-bold text-slate-700 tracking-wider">{text}</h3>
    </div>
  )
}
