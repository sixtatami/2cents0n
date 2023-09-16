import React from "react"

export function convertSvgToShapes(svgString) {
  const parser = new DOMParser()
  const svgDOM = parser.parseFromString(svgString, "image/svg+xml")

  const shapes = {
    eyes: {},
    mouthL: {},
    mouthS: {},
    face: {},
  }

  const parsePaths = (shapeGroup) => {
    const paths = shapeGroup.querySelectorAll("path")
    return Array.from(paths).map((path) => {
      const fillOpacity = path.getAttribute("fill-opacity")
      const fill = fillOpacity
        ? "transparent"
        : path.getAttribute("fill") || "transparent"

      const strokeOpacity = path.getAttribute("stroke-opacity")
      const stroke = strokeOpacity
        ? "transparent"
        : path.getAttribute("stroke") || "transparent"

      return {
        path: path.getAttribute("d") || "none",
        fill: fill,
        stroke: stroke,
        strokeWidth: path.getAttribute("stroke-width")
          ? parseFloat(path.getAttribute("stroke-width"))
          : 0, // Convert to number or 0
        strokeLinecap: "round", //path.getAttribute('stroke-linecap') || "none",
      }
    })
  }

  const parseTransforms = (rect, defaultRect) => {
    if (!rect || !defaultRect) {
      return {}
    }

    const transformAttr = rect.getAttribute("transform")
    const rotate = transformAttr
      ? transformAttr
          .match(/rotate\((.*?)\)/)[1]
          .split(" ")
          .map((value) => parseFloat(value.trim()))
      : [0, 0, 0]

    const defaultX = parseFloat(defaultRect.getAttribute("x")) || 0
    const defaultY = parseFloat(defaultRect.getAttribute("y")) || 0
    const defaultWidth = parseFloat(defaultRect.getAttribute("width")) || 1
    const defaultHeight = parseFloat(defaultRect.getAttribute("height")) || 1

    const rectX = parseFloat(rect.getAttribute("x")) || 0
    const rectY = parseFloat(rect.getAttribute("y")) || 0
    const rectWidth = parseFloat(rect.getAttribute("width")) || 1
    const rectHeight = parseFloat(rect.getAttribute("height")) || 1

    const scaleX = rectWidth / defaultWidth
    const scaleY = rectHeight / defaultHeight
    const translateX = (rectX - defaultX * scaleX) / scaleX
    const translateY = (rectY - defaultY * scaleY) / scaleY

    return {
      rotate,
      translate: [translateX, translateY],
      scale: [scaleX, scaleY],
    }
  }

  const faceGroup = svgDOM.querySelector("#Face")
  const eyeGroup = svgDOM.querySelector("#Eyes")
  const mouthGroupL = svgDOM.querySelector("#MouthL")
  const mouthGroupS = svgDOM.querySelector("#MouthS")

  const faceDefaultRect = faceGroup.querySelector("#Face-Default rect")

  const faceShapes = Array.from(faceGroup.children)
  const eyeShapes = Array.from(eyeGroup.children)
  const mouthShapesL = Array.from(mouthGroupL.children)
  const mouthShapesS = Array.from(mouthGroupS.children)

  faceShapes.forEach((shape) => {
    const shapeId = shape.getAttribute("id")
    const rect = shape.querySelector("rect")
    shapes.face[shapeId] = {
      Transforms: parseTransforms(rect, faceDefaultRect),
      Paths: parsePaths(shape),
    }
  })

  eyeShapes.forEach((shape) => {
    const shapeId = shape.getAttribute("id")
    shapes.eyes[shapeId] = {
      Paths: parsePaths(shape),
    }
  })

  function cleanId(id) {
    if (id.endsWith("-S")) {
      return id.substring(0, id.length - 2)
    }
    if (id.endsWith("-L")) {
      return id.substring(0, id.length - 2)
    }
    return id
  }

  mouthShapesL.forEach((shape) => {
    const originalShapeId = shape.getAttribute("id")
    const cleanedShapeId = cleanId(originalShapeId)
    shapes.mouthL[cleanedShapeId] = {
      Paths: parsePaths(shape),
    }
  })

  mouthShapesS.forEach((shape) => {
    const originalShapeId = shape.getAttribute("id")
    const cleanedShapeId = cleanId(originalShapeId)
    shapes.mouthS[cleanedShapeId] = {
      Paths: parsePaths(shape),
    }
  })

  return shapes
}
