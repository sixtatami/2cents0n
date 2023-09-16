import { useEffect, useState } from "react"
import { useAudioData, visualizeAudio } from "@remotion/media-utils"
import { interpolatePath } from "@remotion/paths"
import { preloadVideo } from "@remotion/preload"
import {
  Audio,
  Sequence,
  interpolate,
  interpolateColors,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion"

import { Dante } from "../../data/Dante"
import { Phone } from "../../data/Phone.js"
import { timeline } from "../../data/Timeline"
import { convertSvgToShapes } from "./importCharacter"

const shapes = {
  Cat: convertSvgToShapes(Dante),
  Phone: convertSvgToShapes(Phone),
}

const timelineDuration = 800

const splitTextIntoLines = (text, maxLength) => {
  const words = text.split(" ")
  let lines = []
  let currentLine = ""

  for (const word of words) {
    if ((currentLine + word).length <= maxLength) {
      currentLine += word + " "
    } else {
      lines.push(currentLine.trim())
      currentLine = word + " "
    }
  }

  lines.push(currentLine.trim())
  return lines
}

// Helper function to find the start and end shapes
const findStartAndEndShapes = (timeline, frame) => {
  let startShapeIndex = 0
  let endShapeIndex = 0

  for (let i = 0; i < timeline.length; i++) {
    if (frame >= timeline[i].keyframe) {
      startShapeIndex = i
    } else {
      endShapeIndex = i
      break
    }
  }

  if (frame >= timeline[timeline.length - 1].keyframe) {
    endShapeIndex = timeline.length - 1
  }

  return [
    startShapeIndex,
    endShapeIndex,
    timeline[startShapeIndex].shape,
    timeline[endShapeIndex].shape,
  ]
}

const performInterpolation = ({
  startShape,
  endShape,
  interpolationProgress,
}) => {
  const interpolatedShapes = []
  const maxShapeCount = Math.max(startShape.length, endShape.length)

  for (let i = 0; i < maxShapeCount; i++) {
    const startPath = startShape[i]?.path
    const endPath = endShape[i]?.path
    const startFill = startShape[i]?.fill
    const endFill = endShape[i]?.fill
    const startStroke = startShape[i]?.stroke
    const endStroke = endShape[i]?.stroke
    const startStrokeWidth = startShape[i]?.strokeWidth
    const endStrokeWidth = endShape[i]?.strokeWidth

    const interpolatedPath = interpolatePath(
      interpolationProgress,
      startPath,
      endPath
    )
    const interpolatedFill = interpolateColors(
      interpolationProgress,
      [0, 1],
      [startFill, endFill]
    )
    const interpolatedStroke = interpolateColors(
      interpolationProgress,
      [0, 1],
      [startStroke, endStroke]
    )
    const interpolatedStrokeWidth = interpolate(
      interpolationProgress,
      [0, 1],
      [startStrokeWidth, endStrokeWidth]
    )

    interpolatedShapes.push({
      path: interpolatedPath,
      fill: interpolatedFill,
      stroke: interpolatedStroke,
      strokeWidth: interpolatedStrokeWidth,
    })
  }

  return interpolatedShapes
}

// Modified interpolateShapes function
const interpolateShapes = ({ shapes, timeline, frame }) => {
  const [startShapeIndex, endShapeIndex, startShapeName, endShapeName] =
    findStartAndEndShapes(timeline, frame)
  const startShape = shapes[startShapeName].Paths
  const endShape = shapes[endShapeName].Paths

  // Calculate the interpolation start and end frames
  const startFrame = timeline[startShapeIndex].keyframe
  const endFrame = timeline[endShapeIndex].keyframe

  // Calculate the spring-based interpolation progress (between 0 and 1)
  let interpolationProgress = spring({
    fps: 30,
    frame: frame - startFrame,
    config: {
      damping: 2,
      stiffness: 80,
      mass: 0.1,
    },
    durationInFrames: endFrame - startFrame,
  })

  return performInterpolation({
    startShape,
    endShape,
    interpolationProgress,
  })
}

const ShapeElement = ({ shapes, timeline }) => {
  const frame = useCurrentFrame()
  const interpolatedShapes = interpolateShapes({ shapes, timeline, frame })

  return renderShapes(interpolatedShapes)
}

const MouthElement = ({ shapes, timeline, audio, timestart }) => {
  const frame = useCurrentFrame()
  const { width, height, fps } = useVideoConfig()
  const audioData = useAudioData(audio)

  if (!audioData) {
    return null
  }

  const adjustedFrame = frame - timestart // Adjust the frame using timestart

  const visualization = visualizeAudio({
    fps,
    frame: adjustedFrame, // Use the adjusted frame
    audioData,
    numberOfSamples: 1,
  })

  const startShape = interpolateShapes({
    shapes: shapes.mouthL,
    timeline,
    frame,
  })
  const endShape = interpolateShapes({
    shapes: shapes.mouthS,
    timeline,
    frame,
  })

  let interpolationProgress = 1 - visualization[0]

  const interpolatedShapes = performInterpolation({
    startShape,
    endShape,
    interpolationProgress,
  })

  return renderShapes(interpolatedShapes)
}

const renderShapes = (interpolatedShapes) => (
  <>
    {interpolatedShapes.map((shape, i) => (
      <path
        key={i}
        d={shape.path}
        fill={shape.fill}
        stroke={shape.stroke}
        strokeWidth={shape.strokeWidth}
        stroke-linecap="round" //{shape.strokeLinecap}
      />
    ))}
  </>
)

const getCameraTransform = (cameraAngle, svgWidth, svgHeight) => {
  const centerX = svgWidth / 2
  const centerY = svgHeight / 2

  let transform = `translate(${centerX}, ${centerY})`

  switch (cameraAngle) {
    case "wide":
      transform += " scale(0.6)"
      break
    case "close":
      transform += " scale(1.4)"
      break
    case "default":
    default:
      transform += " scale(1)"
      break
  }

  transform += ` translate(-${centerX}, -${centerY})`

  return transform
}

export const MyComponent = () => {
  const currentFrame = useCurrentFrame()
  const [currentAudio, setCurrentAudio] = useState(
    staticFile("230912-1-001.mp3")
  )
  // const [currentAudio, setCurrentAudio] = useState(
  // 	'https://2contexttospeech.s3.amazonaws.com/srj14OAn.mp4'
  // );
  useEffect(() => {
    Object.keys(timeline).forEach((character) => {
      const characterData = timeline[character]
      if (
        currentFrame >= characterData.timestart &&
        currentFrame <= characterData.timeend
      ) {
        //setCurrentAudio(characterData.audio);
        setCurrentAudio(staticFile(characterData.audio))
      }
    })
  }, [currentFrame])

  let activeCharacter = null
  let activeTimeline = null
  for (const entry of timeline) {
    if (currentFrame >= entry.timestart && currentFrame <= entry.timeend) {
      activeTimeline = entry
      activeCharacter = shapes[entry.character] // Set the shape data based on the active character
      break
    }
  }

  // Your code for determining the current and next shapes based on the current frame
  let currentIndex = 0
  let nextIndex = 1
  while (nextIndex < activeTimeline.face.length) {
    if (currentFrame >= activeTimeline.face[nextIndex].keyframe) {
      currentIndex = nextIndex
      nextIndex++
    } else {
      break
    }
  }

  const startFrame = activeTimeline.face[currentIndex]?.keyframe || 0
  const endFrame = activeTimeline.face[nextIndex]?.keyframe || timelineDuration

  const startShapeKey = activeTimeline.face[currentIndex]?.shape
  const endShapeKey = activeTimeline.face[nextIndex]?.shape

  const startTransforms = activeCharacter.face[startShapeKey]?.Transforms || {}
  const endTransforms = activeCharacter.face[endShapeKey]?.Transforms || {}

  if (!startTransforms || !endTransforms) {
    // Handle this case accordingly, e.g., return null or some default component.
    return null
  }

  const interpolatedTransforms = Object.keys(startTransforms).reduce(
    (result, key) => {
      // Validate existence of startTransforms and endTransforms for the current key
      if (!startTransforms[key] || !endTransforms[key]) {
        throw new Error(
          `Missing startTransforms or endTransforms for key: ${key}`
        )
      }

      // Validate array lengths are the same for startValue and endValue
      const startValue = startTransforms[key]
      const endValue = endTransforms[key]
      if (startValue.length !== endValue.length) {
        throw new Error(`Mismatched array lengths for key: ${key}`)
      }

      // Perform the interpolation
      const interpolatedValue = startValue.map((value, index) => {
        return spring({
          fps: 30,
          frame: currentFrame - startFrame,
          config: {
            damping: 2,
            stiffness: 80,
            mass: 0.1,
          },
          from: value,
          to: endValue[index],
          durationInFrames: endFrame - startFrame,
        })
      })

      result[key] = interpolatedValue
      return result
    },
    {}
  )

  const interpolateTransforms = (transforms) => {
    const [rotateX, rotateY, rotateZ] = transforms.rotate
    const [translateX, translateY] = transforms.translate
    const [scaleX, scaleY] = transforms.scale

    // Combine the rotate and translate transformations using a matrix transformation
    const combinedTransform = `matrix(${scaleX}, 0, 0, ${scaleY}, ${translateX}, ${translateY})`

    const rotateTransform = `rotate(${rotateX} 190 422)`

    return `${rotateTransform} ${combinedTransform}`
  }

  let activeCamera = "default" // default camera angle
  if (activeTimeline && activeTimeline.camera) {
    activeCamera = activeTimeline.camera
  }

  const cameraTransform = getCameraTransform(activeCamera, 390, 844)
  const maxLength = 20 // Change this to your desired max line length
  const lines = splitTextIntoLines(activeTimeline.spokentext, maxLength)

  return (
    <div>
      <Sequence from={0} durationInFrames={timelineDuration}>
        <Sequence from={activeTimeline.timestart}>
          <Audio src={currentAudio} />
        </Sequence>

        <svg
          width="390"
          height="844"
          viewBox="0 0 390 844"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="100%" height="100%" fill="white" />

          <text
            x="40"
            y="80"
            alignmentBaseline="middle"
            textAnchor="middle"
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize="36"
            fill="black"
          >
            {lines.map((line, i) => (
              <tspan x="50%" dy={i === 0 ? "0" : "1.4em"} key={i}>
                {line}
              </tspan>
            ))}
          </text>

          <g transform={cameraTransform}>
            <ShapeElement
              shapes={activeCharacter.face}
              timeline={activeTimeline.face}
            />

            <g transform={interpolateTransforms(interpolatedTransforms)}>
              <g id="Mouth">
                <MouthElement
                  shapes={activeCharacter}
                  timeline={activeTimeline.mouth}
                  audio={currentAudio}
                  timestart={activeTimeline.timestart} // pass the timestart value
                />
              </g>

              <g id="Eyes">
                <ShapeElement
                  shapes={activeCharacter.eyes}
                  timeline={activeTimeline.eyes}
                />
              </g>
            </g>
          </g>
        </svg>
      </Sequence>
    </div>
  )
}

{
  /* <g id="dante-hand">
<path
	id="phone-shape"
	d="M233.485 613.589C206.955 611.472 171.085 609.004 150.514 612.229C144.835 613.119 139.931 615.331 136.76 619.855C133.735 624.168 132.963 629.653 133.233 635.588L132.76 816.115C132.756 817.466 132.875 819.324 133.649 821.228C136.192 827.483 142.162 831.795 149.043 832.121L226.036 835.768C237.998 836.335 247.359 826.087 246.19 814.547C246.165 814.305 246.142 814.084 246.121 813.879C246.017 812.891 245.955 812.295 245.973 811.677L251.042 632.304C251.087 630.717 251.001 628.627 250.213 626.491C247.634 619.507 241.335 614.216 233.485 613.589Z"
	fill="black"
/>
<path
	id="camera"
	d="M149.349 633.671C149.419 629.253 153.056 625.728 157.474 625.798L173.846 626.055C178.263 626.125 181.788 629.762 181.719 634.18L181.417 653.35C181.348 657.767 177.71 661.292 173.293 661.223L156.921 660.965C152.503 660.896 148.978 657.258 149.048 652.841L149.349 633.671Z"
	fill="#D9D9D9"
/>
<path
	id="hand"
	d="M120.466 755.948L129.4 729.745C130.448 726.67 132.7 724.151 135.639 722.764L136.713 722.258L135.705 758.251L158.955 739.368L159.096 739.514L179.919 729.485C182.647 728.171 185.927 729.13 187.517 731.707C189.07 734.225 188.524 737.502 186.239 739.381L171.024 751.885L171.084 751.947L157.086 762.28L179.865 753.016L179.912 753.138L197.549 752.663C200.45 752.584 203.067 754.398 204.012 757.143C205.246 760.727 203.237 764.615 199.6 765.683L186.204 769.616L186.196 769.595L159.588 779.72L187.961 782.306L187.967 782.344L194.866 784.383C196.741 784.937 198.284 786.278 199.094 788.058C200.935 792.103 198.431 796.791 194.046 797.511L190.458 798.1L190.458 798.101L190.45 798.101L190.399 798.109L190.398 798.1L163.692 797.696C163.33 803.218 162.764 810.293 162.038 814.395C160.722 821.835 156.166 824.865 156.166 824.865L132.942 826.391L132.68 826.207L99.0593 918.768C94.6086 925.85 65.8558 927.843 64.9756 923.816L103.54 840.886L113.472 812.206L120.335 755.846L120.466 755.948Z"
	fill="#BEBAC2"
/>
<path
	id="hand-outline"
	d="M120.466 755.948L120.335 755.846L113.472 812.206L103.54 840.886L64.9756 923.816C65.1605 924.662 66.5762 925.243 68.7384 925.566C70.4547 925.822 72.6414 925.917 75.0564 925.854C84.0782 925.618 96.2862 923.181 99.0594 918.768L132.68 826.207L132.942 826.391L156.166 824.865L161.705 833.191C160.249 834.159 158.566 834.729 156.822 834.843L139.775 835.963L108.459 922.182C108.216 922.849 107.904 923.489 107.526 924.089C105.804 926.83 103.401 928.623 101.478 929.771C99.4611 930.974 97.2608 931.886 95.1628 932.591C90.9656 934 86.191 934.903 81.7921 935.396C77.4063 935.887 72.877 936.029 69.1202 935.679C67.3147 935.511 65.1455 935.184 63.1177 934.453C62.1073 934.088 60.6697 933.462 59.2656 932.356C57.8334 931.227 55.9074 929.159 55.2062 925.951C54.7391 923.814 54.9857 921.583 55.908 919.6L94.2572 837.131L103.674 809.94L110.408 754.638C110.566 753.338 110.974 752.106 111.589 750.998L119.935 726.518C121.857 720.879 125.985 716.261 131.373 713.72L132.447 713.213C135.59 711.731 139.277 711.987 142.185 713.888C145.093 715.79 146.806 719.064 146.709 722.538L146.311 736.755L152.651 731.606C153.804 730.669 155.109 730.029 156.467 729.681L175.579 720.476C182.921 716.939 191.748 719.521 196.027 726.456C199.161 731.535 199.12 737.763 196.313 742.692L197.279 742.666C204.547 742.47 211.101 747.014 213.467 753.888C216.557 762.865 211.526 772.604 202.417 775.278L200.422 775.864C203.834 777.564 206.593 780.394 208.196 783.916C212.765 793.956 206.549 805.593 195.665 807.379L192.249 807.939C192.098 807.967 191.947 807.991 191.795 808.011C191.137 808.104 190.476 808.13 189.821 808.092L172.927 807.837C172.636 810.897 172.289 813.854 171.885 816.137C170.911 821.644 168.686 825.733 166.523 828.533C165.453 829.917 164.412 830.972 163.565 831.73C163.14 832.109 162.761 832.418 162.446 832.659C162.288 832.78 162.146 832.884 162.022 832.973C161.96 833.017 161.902 833.057 161.849 833.094C161.823 833.112 161.797 833.129 161.773 833.145L161.738 833.169L161.721 833.18L161.713 833.186C161.709 833.189 161.705 833.191 156.166 824.865C156.166 824.865 160.722 821.835 162.038 814.396C162.764 810.293 163.33 803.218 163.692 797.696L190.398 798.1L190.399 798.109L190.45 798.101L190.452 798.101L190.458 798.101L190.458 798.1L194.046 797.511C196.503 797.108 198.37 795.458 199.212 793.374C199.873 791.739 199.903 789.836 199.094 788.058C198.284 786.278 196.741 784.937 194.866 784.383L187.967 782.344L187.961 782.306L159.588 779.72L186.196 769.595L186.204 769.616L199.6 765.683C203.237 764.615 205.246 760.727 204.012 757.143C203.067 754.398 200.45 752.584 197.549 752.663L179.912 753.138L179.865 753.016L157.086 762.28L171.084 751.947L171.024 751.885L186.239 739.381C188.524 737.502 189.07 734.225 187.517 731.707C185.927 729.13 182.647 728.171 179.919 729.485L159.096 739.514L158.955 739.368L135.705 758.251L136.713 722.258L135.639 722.764C132.7 724.151 130.448 726.67 129.4 729.745L120.466 755.948Z"
	fill="#722982"
/>
</g> */
}
