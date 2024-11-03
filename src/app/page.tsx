"use client";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@nextui-org/button";
import { Slider } from "@nextui-org/slider";
import { Tabs, Tab } from "@nextui-org/tabs";
import { extractText, randomQuote, randomSentence } from "./actions";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@nextui-org/modal";
import { Input } from "@nextui-org/input";
import { Divider } from "@nextui-org/divider";
import { distance } from "fastest-levenshtein";
import SettingsIcon from "../../components/SettingsIcon";
import UndoRightIcon from "../../components/UndoRightIcon";
import UndoLeftIcon from "../../components/UndoLeftIcon";

type Coords = { x: number; y: number };

type BoundingBox = { start: Coords; end: Coords };

type Stroke = {
  path: Coords[];
  boundingBox: BoundingBox;
};

type Strokes = Stroke[];

type WritingTypes = {
  start: number | null,
  end: number | null,
}

type SentenceTypes = "quotes" | "words";

export default function Home() {
  const canvasRef = useRef<null | HTMLCanvasElement>(null);
  const contextRef = useRef<null | CanvasRenderingContext2D>(null);

  // writing
  const [ numberOfWords, setNumberOfWords ] = useState<number>(5)
  const [ textToCopy, setTextToCopy ] = useState<string>("the quick brown fox jumped over the lazy dog");
  const [ writingTimes, setWritingTimes ] = useState<WritingTypes>({ start: null, end: null });
  const [ pencilSize, setPencilSize ] = useState<number>(2);
  const [ eraserSize, setEraserSize ] = useState<number>(2);
  const [ sentenceType, setSentenceType ] = useState<SentenceTypes>("words");

  const MAX_SENTENCE_LENGTH = 100, MIN_SENTENCE_LENGTH = 1;

  // results
  const [ isAnalyzing, setIsAnalyzing ] = useState<boolean>(false);
  const [ WPM, setWPM ] = useState<number>(0);
  const [ writtenText, setWrittenText ] = useState<string>("");
  const [ accuracy, setAccuracy ] = useState<number>(0);
  const [ legibility, setLegibility ] = useState<number>(0);

  // results modal
  const {isOpen, onOpen, onOpenChange} = useDisclosure();
  const settingsModal = useDisclosure();

  const fetchRandomSentence = async (type: SentenceTypes = sentenceType, length: number = numberOfWords) => {
    let initialSentence = "";

    switch (type) {
      case "quotes":
        initialSentence = await randomQuote();
        break;

      // If there is a invalid key then the default case is words
      case "words": 
      default:
        initialSentence = await randomSentence(length); 
        break;        
    }

    setTextToCopy(initialSentence); // Set the random sentence to state
  };


  // To know if the user is clicking
  const [ isDrawing, setIsDrawing ] = useState(false);
  const [ isUsingEraser, setIsUsingEraser ] = useState(false);
  const [ strokes, setStrokes ] = useState<Strokes>([]);
  const [ undoneStrokes, setUndoneStrokes ] = useState<Strokes>([]);
  const [ isTouchDevice, setIsTouchDevice ] = useState(false);

  async function calculateWritingSpeed() {
    const canvas = canvasRef.current;
    if (!strokes.length || !canvas) return; // There hasn't been anything written yet
    if (!writingTimes.start || !writingTimes.end) return; // Hasn't started writing

    // opening the writing modal
    onOpen();
    setIsAnalyzing(true);

    const img = canvas.toDataURL("image/jpeg").split(';base64,')[1];
    const timeTakenToWrite = (writingTimes.end - writingTimes.start) / (1000 * 60); // Time in minutes
  
    const extracted = await extractText(img, textToCopy);
    const extractedText = extracted.text.trim();
    const extractedWords = extractedText.split(" ");
    const originalWords = textToCopy.split(" ");
  
    const WPM = extractedWords.length / (timeTakenToWrite + 0.0001); // Words Per Minute calculation
    const extractedLegibility = extracted.legibility;
  
    const accuracy = 1 - (distance(textToCopy.trim(), extractedText) / Math.max( textToCopy.length, originalWords.length ));

    setAccuracy(accuracy * 100); // convert to %
    setWPM(WPM)
    setWrittenText(extractedText);
    setLegibility(extractedLegibility);

    setIsAnalyzing(false);
  }

  // current stroke properties
  let lastPosition: Coords = { x: 0, y: 0 };
  let lastDelta: Coords = { x: 0, y: 0 };
  let distanceTraveled: number = 0;
  let lastTimestamp: number = Date.now();
  let sharpTurns: number = 0;
  let boundingBox: BoundingBox = {
    start: { x: Infinity, y: Infinity },
    end: { x: 0, y: 0 },
  };
  let path: Coords[] = [];

  function drawOnCanvas(coords: Coords) {
    const context = contextRef.current;
    if (!isDrawing || !context) return;

    // using the eraser
    if (isUsingEraser) {
      context.globalCompositeOperation="destination-out";
      context.lineWidth = eraserSize;

      context.lineTo(coords.x, coords.y);
      context.stroke();
      return;
    } else {
      context.lineWidth = pencilSize;
      context.globalCompositeOperation="source-over";
    }


    // Handling stroke properties
    const delta: Coords = {
      x: lastPosition.x - coords.x,
      y: lastPosition.y - coords.y,
    };

    const currentMagnitude = Math.sqrt(delta.x ** 2 + delta.y ** 2);
    const lastMagnitude = Math.sqrt(lastDelta.x ** 2 + lastDelta.y ** 2);

    const timeDifference = Date.now() - lastTimestamp;
    const speed = currentMagnitude / timeDifference;


    if (speed === Infinity || currentMagnitude === 0 || lastMagnitude === 0) {
      lastDelta = delta;
      lastPosition = coords;
      return;
    }

    context.lineTo(coords.x, coords.y);
    context.stroke();
    

    distanceTraveled += currentMagnitude;
    const minimumDistanceTraveledForCalculation = 5;

    if (distanceTraveled > minimumDistanceTraveledForCalculation) {

      const speedFactor = Math.min(speed / 10, 1);

      const normalizedDelta = {
        x: delta.x / currentMagnitude,
        y: delta.y / currentMagnitude,
      };
      const normalizedLastDelta = {
        x: lastDelta.x / lastMagnitude,
        y: lastDelta.y / lastMagnitude,
      };

      const dot =
        normalizedDelta.x * normalizedLastDelta.x +
        normalizedDelta.y * normalizedLastDelta.y;
      const angle = Math.acos(dot) * speedFactor * 10;

      const angleThreshold = 0.5;
      if (angle > angleThreshold) {
        sharpTurns++;
      }

      distanceTraveled = 0;
      lastTimestamp = Date.now();
    }

    path.push(coords);
    lastPosition = coords;
    lastDelta = delta;
    boundingBox = {
      start: {
        x: Math.min(coords.x, boundingBox.start.x),
        y: Math.min(coords.y, boundingBox.start.y),
      },
      end: {
        x: Math.max(coords.x, boundingBox.end.x),
        y: Math.max(coords.y, boundingBox.end.y),
      },
    };
  }

  function beginDrawing(coords: Coords) {
    const context = contextRef.current;
    if (isDrawing || !context) return;

    context.beginPath();
    context.moveTo(coords.x, coords.y);
    context.lineTo(coords.x, coords.y);
    context.stroke();

    setWritingTimes(prev => {
      if (prev.start) return prev;
      return { start: Date.now(), end: prev.end };
    });

    context.strokeStyle = "#f4f4f5"
    context.lineCap = "round";
    context.lineWidth = 5

    // isDrawing = true
    setIsDrawing(true)

    // setting default drawing values
    lastPosition = coords;
    lastDelta = coords;
    lastTimestamp = Date.now();
    sharpTurns = 0;
    path = [];
    boundingBox = {
      start: { x: Infinity, y: Infinity },
      end: { x: -Infinity, y: -Infinity },
    };
  }

  async function stopDrawing() {
    const context = contextRef.current;
    if (!context) return;

    context.closePath();
    // isDrawing = false;
    setIsDrawing(false)
    setWritingTimes( { start: writingTimes.start, end: Date.now() } );

    // handle scribbling
    const overlappingBoxes = getOverlappingBoxes(boundingBox);
    if (sharpTurns > 3 && overlappingBoxes > 0) {
      clearOverlappingBoxes(boundingBox);
    } else {
      setStrokes(prev => [ ...prev, { boundingBox, path } ]);
    }

    // TODO: Bounding box visualizer
    // context.beginPath()
    // context.rect(
    //   boundingBox.start.x, 
    //   boundingBox.start.y,
    //   boundingBox.end.x - boundingBox.start.x, 
    //   boundingBox.end.y - boundingBox.start.y,
    // )
    // context.fill();
  }

  // Handling initial load
  useEffect(() => {
    fetchRandomSentence();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    contextRef.current = context;
    if (!context) return;

    // Get the device pixel ratio and size
    const scale = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Set canvas size accounting for pixel ratio
    canvas.width = width * scale;
    canvas.height = height * scale;
    
    // Set display size using CSS
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Scale the context to match device pixel ratio
    context.scale(scale, scale);

    // Set drawing styles
    context.strokeStyle = "red";
    context.lineWidth = 100;

    const handleResize = () => {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;
        
        // Update canvas size
        canvas.width = newWidth * scale;
        canvas.height = newHeight * scale;
        
        // Update CSS size
        canvas.style.width = `${newWidth}px`;
        canvas.style.height = `${newHeight}px`;

        // Rescale context
        context.scale(scale, scale);

        // Restore drawing styles
        context.strokeStyle = "red";
        context.lineWidth = 100;
    };

    window.addEventListener("resize", handleResize);

    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    setIsTouchDevice(isTouch);

    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
        window.removeEventListener("resize", handleResize);
        document.body.style.overflow = "";
        document.body.style.touchAction = "";
    };
}, []);

  // resetting the timer once the canvas is erased again
  useEffect(() => {
    if (strokes.length === 0) {
      setWritingTimes({ start: null, end: null });
    }
  }, [strokes]);

  // changing the sentences when the number of words changes 
  useEffect(() => {
    fetchRandomSentence();
  }, [ numberOfWords ]);

  function calculateBoundingBoxOverlap(box1: BoundingBox, box2: BoundingBox): number {
    const x_overlap1 = Math.max(box1.start.x, box2.start.x);
    const y_overlap1 = Math.max(box1.start.y, box2.start.y);
    const x_overlap2 = Math.min(box1.end.x, box2.end.x);
    const y_overlap2 = Math.min(box1.end.y, box2.end.y);
  
    const overlap_width = x_overlap2 - x_overlap1;
    const overlap_height = y_overlap2 - y_overlap1;
  
    if (overlap_width <= 0 || overlap_height <= 0) return 0;
  
    const overlapArea = overlap_width * overlap_height;
  
    const box1Area = (box1.end.x - box1.start.x) * (box1.end.y - box1.start.y);
  
    return (overlapArea / box1Area);
  }

  function getOverlappingBoxes(box: BoundingBox) {
    const overlappingBoxes = strokes.filter((stroke) => {
      if (stroke.boundingBox === box) return;
      const overlap = calculateBoundingBoxOverlap(stroke.boundingBox, box);
      return overlap > 0.5;
    });
    return overlappingBoxes.length;
  }

  function clearOverlappingBoxes(box: BoundingBox) {
    const context = contextRef.current;
    const canvas = canvasRef.current;
    if (!context || !canvas) return;

    // Clear the entire canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

    const strokesToKeep = strokes.filter((stroke) => {
      const overlap = calculateBoundingBoxOverlap(stroke.boundingBox, box);
      return overlap < 0.5
    });

    strokesToKeep.forEach((stroke) => {
      const firstCoord = stroke.path.at(0);
      if (firstCoord) {
        context.moveTo(firstCoord.x, firstCoord.y);
      }

      context.beginPath();

      stroke.path.forEach((coord) => {
        context.lineTo(coord.x, coord.y);
        context.stroke();
      });

      context.closePath();
    });

    setStrokes( strokesToKeep );
  }

  // To convert events to coordinates
  function getCoords(
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) {
    const rect = e.currentTarget.getBoundingClientRect();
    let x = 0,
      y = 0;

    if ("touches" in e) {
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    } else {
      x = e.clientX;
      y = e.clientY;
    }

    return {
      x: x - rect.left,
      y: y - rect.top,
    };
  }

  function drawingHandler(
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) {
    e.preventDefault()
    drawOnCanvas(getCoords(e));
  }

  function beginHandler(
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) {

    e.preventDefault();
    setUndoneStrokes([]); // clears the previous history once a new drawing begins
    beginDrawing(getCoords(e));
  }

  function stopHandler(
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) {
    e.preventDefault()
    stopDrawing();
  }

  const handleUndo = () => {
    if (strokes.length === 0) return;

    const newStrokes = [...strokes];
    const removedStroke = newStrokes.pop();
    
    if (removedStroke) {
      setStrokes(newStrokes);
      setUndoneStrokes(prev => [...prev, removedStroke]);
      
      // Redraw canvas with updated strokes
      const context = contextRef.current;
      const canvas = canvasRef.current;
      if (!context || !canvas) return;

      // Clear canvas
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Redraw remaining strokes
      newStrokes.forEach(stroke => {
        if (!stroke.path.length) return;

        context.beginPath();
        context.moveTo(stroke.path[0].x, stroke.path[0].y);
        
        stroke.path.forEach(coord => {
          context.lineTo(coord.x, coord.y);
        });
        
        context.stroke();
        context.closePath();
      });
    }
  };

  const handleRedo = () => {
    if (undoneStrokes.length === 0) return;

    const newUndoneStrokes = [...undoneStrokes];
    const strokeToRedo = newUndoneStrokes.pop();
    
    if (strokeToRedo) {
      setUndoneStrokes(newUndoneStrokes);
      setStrokes(prev => [...prev, strokeToRedo]);
      
      // Redraw the restored stroke
      const context = contextRef.current;
      if (!context || !strokeToRedo.path.length) return;

      context.beginPath();
      context.moveTo(strokeToRedo.path[0].x, strokeToRedo.path[0].y);
      
      strokeToRedo.path.forEach(coord => {
        context.lineTo(coord.x, coord.y);
      });
      
      context.stroke();
      context.closePath();
    }
  };



  return (<>
    <div>
      <h1 className="text-neutral-600 box-border p-4 text-justify text-[5vw] max-h-[50vh]">{ textToCopy }</h1>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} className="dark text-foreground">
        <ModalContent>
          <ModalHeader>Results</ModalHeader>

          { isAnalyzing ?  
          <div className="p-4 w-full flex justify-center">
            <Button variant="light" size="lg" isLoading></Button>
          </div>
          : 
          <>
            <ModalBody>
              <strong>{writtenText}</strong>
              <Divider></Divider>
              <p>Words Per Minute (WPM): { WPM.toFixed(2) }</p>
              <p>Accuracy: { accuracy.toFixed(2) }%</p>
              <p>Legibility: { legibility }%</p>
            </ModalBody>
          </>
          }
      
        </ModalContent>
      </Modal>

      <Modal isOpen={settingsModal.isOpen} onOpenChange={settingsModal.onOpenChange} className="dark text-foreground">
        <ModalContent>
          <ModalHeader>Settings</ModalHeader>

          <div className="flex flex-col gap-4 px-4 pb-4">
            <Tabs fullWidth aria-label="Number of words"
              defaultSelectedKey={ [5, 10, 15].includes(numberOfWords) ? numberOfWords : "custom" }
              onSelectionChange={(key) => {
                if (key === "custom") return; // ignore custom inputs
                setNumberOfWords( key as number );
                fetchRandomSentence(sentenceType, key as number);;
              }}
              color="primary"
            >
              <Tab title="5" key={5}></Tab>
              <Tab title="10" key={10}></Tab>
              <Tab title="15" key={15}></Tab>
              <Tab title="custom" key={"custom"}>
                <Input 
                  label="Number of Words"
                  type="number"
                  value={numberOfWords + ""}
                  onChange={(e) => setNumberOfWords( parseInt(e.target.value) )}
                  onBlur={(e) => {
                    //@ts-ignore
                    const value = parseInt(e.target.value);
                    const clampedValue = Math.max(Math.min(value, MAX_SENTENCE_LENGTH), MIN_SENTENCE_LENGTH);
                    setNumberOfWords(clampedValue);
                    fetchRandomSentence(sentenceType, clampedValue);
                  }}
                  min={MIN_SENTENCE_LENGTH}
                  max={MAX_SENTENCE_LENGTH}
                />
              </Tab>
            </Tabs>

            <Input 
              label="Custom Sentence" 
              defaultValue={ textToCopy }

              // Updating the custom sentence
              onInput={(e) => {
                const sentence = e.currentTarget.value;
                setTextToCopy(sentence);
              }}
              // If not text is entered when blurred, then generate custom text
              onBlur={(e) => {
                // @ts-expect-error
                const sentence = e.currentTarget.value;
                if (sentence || textToCopy) return; // ignore if a value is entered
                fetchRandomSentence();
              }}
            ></Input>

            

            <Tabs 
              className="w-full" 
              color="primary"
              fullWidth 
              aria-label="Type of sentences to copy."
              defaultSelectedKey={ sentenceType }
              onSelectionChange={(key) => {
                setSentenceType(key as SentenceTypes);
                fetchRandomSentence(key as SentenceTypes); // update change
              }}
            >
              <Tab key="words" title="Words"></Tab>
              <Tab key="quotes" title="Quotes"></Tab>
            </Tabs>

            <Slider 
              label="Pencil Size" 
              step={1} 
              maxValue={20} 
              minValue={1} 
              defaultValue={ pencilSize || 2}
              className="max-w-md"
              onChange={(value) => {
                setPencilSize(value as number);
              }}
            />

            <Slider 
              label="Eraser Size" 
              step={1} 
              maxValue={20} 
              minValue={1} 
              defaultValue={ eraserSize || 2}
              className="max-w-md"
              onChange={(value) => {
                setEraserSize(value as number);
              }}
            />

          </div>

        </ModalContent>
      </Modal>

      {/* <Button color="danger" onClick={onOpen}>OPEN MODAL</Button> */}

      <Button
          isDisabled={ strokes.length === 0 || isAnalyzing }
          color="primary"
          className="fixed px-12 py-6 rounded-xl bottom-4 right-4"

          onClick={calculateWritingSpeed}
      >Finish</Button>

      <div className="fixed bottom-4 left-4 flex flex-col gap-2 md:flex-row">
        <Button
          size="lg"
          isIconOnly
          color={ isUsingEraser ? "primary" : "danger" }
          onClick={() => setIsUsingEraser(prev => !prev) }
        >
          <img 
            className="p-2 aspect-square object-fit"
            src={ isUsingEraser ? "/pencil_icon.png" : "/eraser_icon.png" } 
            alt={ isUsingEraser ? "use pencil" : "use eraser" } 
          />
        </Button>

        <Button
          aria-label="Undo Button - Removes last stroke"
          className="p-2"
          size="lg"
          isIconOnly
          disabled={strokes.length === 0}
          onClick={handleUndo}
        >
          <UndoLeftIcon></UndoLeftIcon>
        </Button>

        <Button
          className="p-2"
          aria-label="Redo Button - Reverts strokes"
          size="lg"
          isIconOnly
          disabled={undoneStrokes.length === 0}
          onClick={handleRedo}
        >
          <UndoRightIcon></UndoRightIcon>
        </Button>

        <Button
          className="p-2"
          aria-label="Clear Canvas on first click, refreshes new sentences on second."
          size="lg"
          isIconOnly
          onClick={() => {
            const canvas = canvasRef.current;
            const context = contextRef.current;
            if (!canvas || !context) return;

            // If the board is clear, then reset the words
            if (strokes.length === 0) {
              fetchRandomSentence();
            }

            // Clearing the board
            context.clearRect(0, 0, canvas.width, canvas.height);
            setStrokes([]);
            setUndoneStrokes([]);

          }}
        >
          Reset
        </Button>

        <Button
          aria-label="Open Settings Modal"
          onPress={settingsModal.onOpen}
          isIconOnly
          size="lg"
        >
          <SettingsIcon></SettingsIcon>
        </Button>
      </div>


      <canvas
        className="bg-neutral-800 bg-grid-pattern bg-grid-size"

        ref={canvasRef}
        onPointerDown={!isTouchDevice ? beginHandler : undefined}
        onPointerMove={!isTouchDevice ? drawingHandler : undefined}
        onPointerUp={!isTouchDevice ? stopHandler : undefined}
        onTouchStart={isTouchDevice ? beginHandler : undefined}
        onTouchMove={isTouchDevice ? drawingHandler : undefined}
        onTouchEnd={isTouchDevice ? stopHandler : undefined}
      />

    </div>
  </>
  );
}
