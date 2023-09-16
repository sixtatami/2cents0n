import { Player } from "@remotion/player"
import { MyComponent} from './VideoComposition'

export const MyPlayer = () => {
  return (
    <Player
      component={MyComponent}
      durationInFrames={800}
      compositionWidth={390}
      compositionHeight={844}
      fps={30}
      controls
      loop
    />
  )
}


