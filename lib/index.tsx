import * as isEqual from "lodash.isequal";
import * as qrGenerator from "qrcode-generator";
import * as React from "react";

type EyeColor = string | InnerOuterEyeColor;
type InnerOuterEyeColor = {
  inner: string;
  outer: string;
};

type CornerRadii = number | [number, number, number, number] | InnerOuterRadii;
type InnerOuterRadii = {
  inner: number | [number, number, number, number];
  outer: number | [number, number, number, number];
};

export interface IProps {
  value?: string;
  ecLevel?: "L" | "M" | "Q" | "H";
  enableCORS?: boolean;
  size?: number;
  quietZone?: number;
  bgColor?: string;
  fgColor?: string;
  logoImage?: string;
  logoWidth?: number;
  logoHeight?: number;
  logoOpacity?: number;
  logoOnLoad?: (e: Event) => void;
  removeQrCodeBehindLogo?: boolean;
  logoPadding?: number;
  logoPaddingStyle?: "square" | "circle";
  eyeRadius?: CornerRadii | [CornerRadii, CornerRadii, CornerRadii];
  eyeColor?: EyeColor | [EyeColor, EyeColor, EyeColor];
  qrStyle?:
    | "squares"
    | "hearts"
    | "diamonds"
    | "stars"
    | "octagons"
    | "pentagons"
    | "triangles"
    | "dots"
    | "fluid";
  style?: React.CSSProperties;
  id?: string;
}

interface ICoordinates {
  row: number;
  col: number;
}

export class QRCode extends React.Component<IProps, {}> {
  private canvasRef = React.createRef<HTMLCanvasElement>();

  public static defaultProps: IProps = {
    value: "https://reactjs.org/",
    ecLevel: "M",
    enableCORS: false,
    size: 150,
    quietZone: 10,
    bgColor: "#FFFFFF",
    fgColor: "#000000",
    logoOpacity: 1,
    qrStyle: "squares", // Background design
    eyeRadius: [0, 0, 0],
    logoPaddingStyle: "square",
  };

  public download(fileType?: "png" | "jpg" | "webp", fileName?: string) {
    if (this.canvasRef.current) {
      let mimeType;

      switch (fileType) {
        case "jpg":
          mimeType = "image/jpeg";
          break;
        case "webp":
          mimeType = "image/webp";
          break;
        case "png":
        default:
          mimeType = "image/png";
          break;
      }

      const url = this.canvasRef.current.toDataURL(mimeType, 1.0);
      const link = document.createElement("a");
      link.download = fileName ?? "qr-generator-criqlets";
      link.href = url;
      link.click();
    }
  }

  private utf16to8(str: string): string {
    let out: string = "",
      i: number,
      c: number;
    const len: number = str.length;
    for (i = 0; i < len; i++) {
      c = str.charCodeAt(i);
      if (c >= 0x0001 && c <= 0x007f) {
        out += str.charAt(i);
      } else if (c > 0x07ff) {
        out += String.fromCharCode(0xe0 | ((c >> 12) & 0x0f));
        out += String.fromCharCode(0x80 | ((c >> 6) & 0x3f));
        out += String.fromCharCode(0x80 | ((c >> 0) & 0x3f));
      } else {
        out += String.fromCharCode(0xc0 | ((c >> 6) & 0x1f));
        out += String.fromCharCode(0x80 | ((c >> 0) & 0x3f));
      }
    }
    return out;
  }

  /**
   * Draw a rounded square in the canvas
   */
  private drawRoundedSquare(
    lineWidth: number,
    x: number,
    y: number,
    size: number,
    color: string,
    radii: number | number[],
    fill: boolean,
    ctx: CanvasRenderingContext2D
  ) {
    ctx.lineWidth = lineWidth;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    // Adjust coordinates so that the outside of the stroke is aligned to the edges
    y += lineWidth / 2;
    x += lineWidth / 2;
    size -= lineWidth;

    if (!Array.isArray(radii)) {
      radii = [radii, radii, radii, radii];
    }

    // Radius should not be greater than half the size or less than zero
    radii = radii.map((r) => {
      r = Math.min(r, size / 2);
      return r < 0 ? 0 : r;
    });

    const rTopLeft = radii[0] || 0;
    const rTopRight = radii[1] || 0;
    const rBottomRight = radii[2] || 0;
    const rBottomLeft = radii[3] || 0;

    ctx.beginPath();

    ctx.moveTo(x + rTopLeft, y);

    ctx.lineTo(x + size - rTopRight, y);
    if (rTopRight) ctx.quadraticCurveTo(x + size, y, x + size, y + rTopRight);

    ctx.lineTo(x + size, y + size - rBottomRight);
    if (rBottomRight)
      ctx.quadraticCurveTo(
        x + size,
        y + size,
        x + size - rBottomRight,
        y + size
      );

    ctx.lineTo(x + rBottomLeft, y + size);
    if (rBottomLeft)
      ctx.quadraticCurveTo(x, y + size, x, y + size - rBottomLeft);

    ctx.lineTo(x, y + rTopLeft);
    if (rTopLeft) ctx.quadraticCurveTo(x, y, x + rTopLeft, y);

    ctx.closePath();

    ctx.stroke();
    if (fill) {
      ctx.fill();
    }
  }

  /**
   * Draw a single positional pattern eye.
   */
  private drawPositioningPattern(
    ctx: CanvasRenderingContext2D,
    cellSize: number,
    offset: number,
    row: number,
    col: number,
    color: EyeColor,
    radii: CornerRadii = [0, 0, 0, 0]
  ) {
    const lineWidth = Math.ceil(cellSize);

    let radiiOuter;
    let radiiInner;
    if (typeof radii !== "number" && !Array.isArray(radii)) {
      radiiOuter = radii.outer || 0;
      radiiInner = radii.inner || 0;
    } else {
      radiiOuter = radii as CornerRadii;
      radiiInner = radiiOuter;
    }

    let colorOuter;
    let colorInner;
    if (typeof color !== "string") {
      colorOuter = color.outer;
      colorInner = color.inner;
    } else {
      colorOuter = color;
      colorInner = color;
    }

    let y = row * cellSize + offset;
    let x = col * cellSize + offset;
    let size = cellSize * 7;

    // Outer box
    this.drawRoundedSquare(
      lineWidth,
      x,
      y,
      size,
      colorOuter,
      radiiOuter,
      false,
      ctx
    );

    // Inner box
    size = cellSize * 3;
    y += cellSize * 2;
    x += cellSize * 2;
    this.drawRoundedSquare(
      lineWidth,
      x,
      y,
      size,
      colorInner,
      radiiInner,
      true,
      ctx
    );
  }

  /**
   * Is this dot inside a positional pattern zone.
   */
  private isInPositioninZone(col: number, row: number, zones: ICoordinates[]) {
    return zones.some(
      (zone) =>
        row >= zone.row &&
        row <= zone.row + 7 &&
        col >= zone.col &&
        col <= zone.col + 7
    );
  }

  private transformPixelLengthIntoNumberOfCells(
    pixelLength: number,
    cellSize: number
  ) {
    return pixelLength / cellSize;
  }

  private isCoordinateInImage(
    col: number,
    row: number,
    dWidthLogo: number,
    dHeightLogo: number,
    dxLogo: number,
    dyLogo: number,
    cellSize: number,
    logoImage: string
  ) {
    if (logoImage) {
      const numberOfCellsMargin = 2;
      const firstRowOfLogo = this.transformPixelLengthIntoNumberOfCells(
        dxLogo,
        cellSize
      );
      const firstColumnOfLogo = this.transformPixelLengthIntoNumberOfCells(
        dyLogo,
        cellSize
      );
      const logoWidthInCells =
        this.transformPixelLengthIntoNumberOfCells(dWidthLogo, cellSize) - 1;
      const logoHeightInCells =
        this.transformPixelLengthIntoNumberOfCells(dHeightLogo, cellSize) - 1;

      return (
        row >= firstRowOfLogo - numberOfCellsMargin &&
        row <= firstRowOfLogo + logoWidthInCells + numberOfCellsMargin && // check rows
        col >= firstColumnOfLogo - numberOfCellsMargin &&
        col <= firstColumnOfLogo + logoHeightInCells + numberOfCellsMargin
      ); // check cols
    } else {
      return false;
    }
  }

  constructor(props: IProps) {
    super(props);
  }

  shouldComponentUpdate(nextProps: IProps) {
    return !isEqual(this.props, nextProps);
  }

  componentDidMount() {
    this.update();
  }

  componentDidUpdate() {
    this.update();
  }

  update() {
    const {
      value,
      ecLevel,
      enableCORS,
      bgColor,
      fgColor,
      logoImage,
      logoOpacity,
      logoOnLoad,
      removeQrCodeBehindLogo,
      qrStyle,
      eyeRadius,
      eyeColor,
      logoPaddingStyle,
    } = this.props;

    // just make sure that these params are passed as numbers
    const size = +this.props.size;
    const quietZone = +this.props.quietZone;
    const logoWidth = this.props.logoWidth ? +this.props.logoWidth : 0;
    const logoHeight = this.props.logoHeight ? +this.props.logoHeight : 0;
    const logoPadding = this.props.logoPadding ? +this.props.logoPadding : 0;

    const qrCode = qrGenerator(0, ecLevel);
    qrCode.addData(this.utf16to8(value));
    qrCode.make();

    const canvas: HTMLCanvasElement = this.canvasRef?.current;
    const ctx: CanvasRenderingContext2D = canvas.getContext("2d");

    const canvasSize = size + 2 * quietZone;
    const length = qrCode.getModuleCount();
    const cellSize = size / length;
    const scale = window.devicePixelRatio || 1;
    canvas.height = canvas.width = canvasSize * scale;
    ctx.scale(scale, scale);

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    const offset = quietZone;

    const positioningZones: ICoordinates[] = [
      { row: 0, col: 0 },
      { row: 0, col: length - 7 },
      { row: length - 7, col: 0 },
    ];

    ctx.strokeStyle = fgColor;
    // PATTERN STYLES
    // HEARTS - Estilo
    if (qrStyle === "hearts") {
      ctx.fillStyle = fgColor;
      for (var row = 0; row < length; row++) {
        for (var col = 0; col < length; col++) {
          if (
            qrCode.isDark(row, col) &&
            !this.isInPositioninZone(row, col, positioningZones)
          ) {
            var centerX = Math.round(col * cellSize) + cellSize / 2 + offset;
            var centerY = Math.round(row * cellSize) + cellSize / 2 + offset;
            var radius = cellSize / 4;

            ctx.beginPath();
            ctx.moveTo(centerX, centerY + radius);
            ctx.bezierCurveTo(
              centerX + radius,
              centerY + radius / 1.5,
              centerX + radius * 2,
              centerY - radius / 3,
              centerX,
              centerY - radius * 2
            );
            ctx.bezierCurveTo(
              centerX - radius * 2,
              centerY - radius / 3,
              centerX - radius,
              centerY + radius / 1.5,
              centerX,
              centerY + radius
            );
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }
    // STARS - STYLE
    else if (qrStyle === "stars") {
      ctx.fillStyle = fgColor;
      var starPoints = 5; // Número de puntos de la estrella
      var outerRadius = cellSize / 2;
      var innerRadius = outerRadius / 2;
      for (var row = 0; row < length; row++) {
        for (var col = 0; col < length; col++) {
          if (
            qrCode.isDark(row, col) &&
            !this.isInPositioninZone(row, col, positioningZones)
          ) {
            var centerX = Math.round(col * cellSize) + cellSize / 2 + offset;
            var centerY = Math.round(row * cellSize) + cellSize / 2 + offset;
            var angle = Math.PI / 5; // Ángulo entre los puntos de la estrella

            ctx.beginPath();
            for (var i = 0; i < 2 * starPoints; i++) {
              var radius = i % 2 === 0 ? outerRadius : innerRadius;
              var x = centerX + radius * Math.cos(i * angle);
              var y = centerY - radius * Math.sin(i * angle);
              if (i === 0) {
                ctx.moveTo(x, y);
              } else {
                ctx.lineTo(x, y);
              }
            }
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }
    // DIAMONS - STYLE
    else if (qrStyle === "diamonds") {
      ctx.fillStyle = fgColor;
      var halfCellSize = cellSize / 2;
      for (var row = 0; row < length; row++) {
        for (var col = 0; col < length; col++) {
          if (
            qrCode.isDark(row, col) &&
            !this.isInPositioninZone(row, col, positioningZones)
          ) {
            var centerX = Math.round(col * cellSize) + halfCellSize + offset;
            var centerY = Math.round(row * cellSize) + halfCellSize + offset;

            ctx.beginPath();
            ctx.moveTo(centerX, centerY - halfCellSize); // top
            ctx.lineTo(centerX + halfCellSize, centerY); // right
            ctx.lineTo(centerX, centerY + halfCellSize); // bottom
            ctx.lineTo(centerX - halfCellSize, centerY); // left
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }
    // OCTAGONS - STYLE
    else if (qrStyle === "octagons") {
      ctx.fillStyle = fgColor;
      var numSides = 8; // Número de lados del octágono
      var radius = cellSize / 2;
      var angleStep = (2 * Math.PI) / numSides;
      for (var row = 0; row < length; row++) {
        for (var col = 0; col < length; col++) {
          if (
            qrCode.isDark(row, col) &&
            !this.isInPositioninZone(row, col, positioningZones)
          ) {
            var centerX = Math.round(col * cellSize) + radius + offset;
            var centerY = Math.round(row * cellSize) + radius + offset;

            ctx.beginPath();
            for (var i = 0; i < numSides; i++) {
              var x = centerX + radius * Math.cos(i * angleStep);
              var y = centerY + radius * Math.sin(i * angleStep);
              if (i === 0) {
                ctx.moveTo(x, y);
              } else {
                ctx.lineTo(x, y);
              }
            }
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }
    // PENTAGONS - STYLE
    else if (qrStyle === "pentagons") {
      ctx.fillStyle = fgColor;
      var numSides = 5; // Número de lados del pentágono
      var radius = cellSize / 2;
      var angleStep = (2 * Math.PI) / numSides;
      var innerRadius = radius * Math.cos(Math.PI / numSides);
      for (var row = 0; row < length; row++) {
        for (var col = 0; col < length; col++) {
          if (
            qrCode.isDark(row, col) &&
            !this.isInPositioninZone(row, col, positioningZones)
          ) {
            var centerX = Math.round(col * cellSize) + radius + offset;
            var centerY = Math.round(row * cellSize) + radius + offset;

            ctx.beginPath();
            for (var i = 0; i < numSides; i++) {
              var x = centerX + radius * Math.cos(i * angleStep);
              var y = centerY + radius * Math.sin(i * angleStep);
              if (i === 0) {
                ctx.moveTo(x, y);
              } else {
                ctx.lineTo(x, y);
              }
            }
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }
    // TRIANGLES - STYLE
    else if (qrStyle === "triangles") {
      ctx.fillStyle = fgColor;
      var numSides = 3; // Número de lados del triángulo
      var radius = cellSize / 2;
      var angleStep = (2 * Math.PI) / numSides;
      for (var row = 0; row < length; row++) {
        for (var col = 0; col < length; col++) {
          if (
            qrCode.isDark(row, col) &&
            !this.isInPositioninZone(row, col, positioningZones)
          ) {
            var centerX = Math.round(col * cellSize) + radius + offset;
            var centerY = Math.round(row * cellSize) + radius + offset;

            ctx.beginPath();
            for (var i = 0; i < numSides; i++) {
              var x = centerX + radius * Math.cos(i * angleStep);
              var y = centerY + radius * Math.sin(i * angleStep);
              if (i === 0) {
                ctx.moveTo(x, y);
              } else {
                ctx.lineTo(x, y);
              }
            }
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }
    // DOTS - STYLE
    else if (qrStyle === "dots") {
      ctx.fillStyle = fgColor;
      const radius = cellSize / 2;
      for (let row = 0; row < length; row++) {
        for (let col = 0; col < length; col++) {
          if (
            qrCode.isDark(row, col) &&
            !this.isInPositioninZone(row, col, positioningZones)
          ) {
            ctx.beginPath();
            ctx.arc(
              Math.round(col * cellSize) + radius + offset,
              Math.round(row * cellSize) + radius + offset,
              (radius / 100) * 75,
              0,
              2 * Math.PI,
              false
            );
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }
    // FLUID STYLE
    else if (qrStyle === "fluid") {
      var radius = cellSize / 1.5; // Adjust this value to control the roundness of the corners
      for (let row = 0; row < length; row++) {
        for (let col = 0; col < length; col++) {
          if (
            qrCode.isDark(row, col) &&
            !this.isInPositioninZone(row, col, positioningZones)
          ) {
            ctx.fillStyle = fgColor;
            const x = Math.round(col * cellSize) + offset;
            const y = Math.round(row * cellSize) + offset;
            const w =
              Math.ceil((col + 1) * cellSize) - Math.floor(col * cellSize);
            const h =
              Math.ceil((row + 1) * cellSize) - Math.floor(row * cellSize);

            // Determine which corners should be rounded
            const isDarkUp = row > 0 && qrCode.isDark(row - 1, col);
            const isDarkDown = row < length - 1 && qrCode.isDark(row + 1, col);
            const isDarkLeft = col > 0 && qrCode.isDark(row, col - 1);
            const isDarkRight = col < length - 1 && qrCode.isDark(row, col + 1);

            ctx.beginPath();
            if (!isDarkUp && !isDarkLeft) {
              ctx.moveTo(x + radius, y);
            } else {
              ctx.moveTo(x, y);
            }
            if (!isDarkUp && !isDarkRight) {
              ctx.lineTo(x + w - radius, y);
              ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
            } else {
              ctx.lineTo(x + w, y);
            }
            if (!isDarkRight && !isDarkDown) {
              ctx.lineTo(x + w, y + h - radius);
              ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
            } else {
              ctx.lineTo(x + w, y + h);
            }
            if (!isDarkDown && !isDarkLeft) {
              ctx.lineTo(x + radius, y + h);
              ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
            } else {
              ctx.lineTo(x, y + h);
            }
            if (!isDarkLeft && !isDarkUp) {
              ctx.lineTo(x, y + radius);
              ctx.quadraticCurveTo(x, y, x + radius, y);
            } else {
              ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }
    // SQUARES STYLE
    else {
      for (var row_3 = 0; row_3 < length; row_3++) {
        for (var col_3 = 0; col_3 < length; col_3++) {
          if (
            qrCode.isDark(row_3, col_3) &&
            !this.isInPositioninZone(row_3, col_3, positioningZones)
          ) {
            ctx.fillStyle = fgColor;
            var w =
              Math.ceil((col_3 + 1) * cellSize) - Math.floor(col_3 * cellSize);
            var h =
              Math.ceil((row_3 + 1) * cellSize) - Math.floor(row_3 * cellSize);
            ctx.fillRect(
              Math.round(col_3 * cellSize) + offset,
              Math.round(row_3 * cellSize) + offset,
              w,
              h
            );
          }
        }
      }
    }
    // -------------------------------------------------
    // Draw positioning patterns
    for (let i = 0; i < 3; i++) {
      const { row, col } = positioningZones[i];

      let radii = eyeRadius;
      let color;

      if (Array.isArray(radii)) {
        radii = radii[i];
      }
      if (typeof radii == "number") {
        radii = [radii, radii, radii, radii];
      }

      if (!eyeColor) {
        // if not specified, eye color is the same as foreground,
        color = fgColor;
      } else {
        if (Array.isArray(eyeColor)) {
          // if array, we pass the single color
          color = eyeColor[i];
        } else {
          color = eyeColor as EyeColor;
        }
      }

      this.drawPositioningPattern(
        ctx,
        cellSize,
        offset,
        row,
        col,
        color,
        radii as CornerRadii
      );
    }

    if (logoImage) {
      const image = new Image();
      if (enableCORS) {
        image.crossOrigin = "Anonymous";
      }
      image.onload = (e: Event) => {
        ctx.save();

        const dWidthLogo = logoWidth || size * 0.2;
        const dHeightLogo = logoHeight || dWidthLogo;
        const dxLogo = (size - dWidthLogo) / 2;
        const dyLogo = (size - dHeightLogo) / 2;

        if (removeQrCodeBehindLogo || logoPadding) {
          ctx.beginPath();

          ctx.strokeStyle = bgColor;
          ctx.fillStyle = bgColor;

          const dWidthLogoPadding = dWidthLogo + 2 * logoPadding;
          const dHeightLogoPadding = dHeightLogo + 2 * logoPadding;
          const dxLogoPadding = dxLogo + offset - logoPadding;
          const dyLogoPadding = dyLogo + offset - logoPadding;

          if (logoPaddingStyle === "circle") {
            const dxCenterLogoPadding = dxLogoPadding + dWidthLogoPadding / 2;
            const dyCenterLogoPadding = dyLogoPadding + dHeightLogoPadding / 2;
            ctx.ellipse(
              dxCenterLogoPadding,
              dyCenterLogoPadding,
              dWidthLogoPadding / 2,
              dHeightLogoPadding / 2,
              0,
              0,
              2 * Math.PI
            );
            ctx.stroke();
            ctx.fill();
          } else {
            ctx.fillRect(
              dxLogoPadding,
              dyLogoPadding,
              dWidthLogoPadding,
              dHeightLogoPadding
            );
          }
        }

        ctx.globalAlpha = logoOpacity;
        ctx.drawImage(
          image,
          dxLogo + offset,
          dyLogo + offset,
          dWidthLogo,
          dHeightLogo
        );
        ctx.restore();
        if (logoOnLoad) {
          logoOnLoad(e);
        }
      };
      image.src = logoImage;
    }
  }

  render() {
    const qrSize = +this.props.size + 2 * +this.props.quietZone;

    return (
      <canvas
        id={this.props.id ?? "qr-generator-criqlets"}
        height={qrSize}
        width={qrSize}
        style={{
          height: qrSize + "px",
          width: qrSize + "px",
          ...this.props.style,
        }}
        ref={this.canvasRef}
      />
    );
  }
}
