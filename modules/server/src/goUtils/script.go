package main
import (
  "fmt"
  "bufio"
  "io"
  "os"
  "strings"
  "encoding/json"
  "time"
)

func main() {
  var inputChunks []string
  var jsonString string
  var jsonMap map[string]interface{}
  var processingStart = int32(time.Now().Unix())
  mes := read(os.Stdin) //Reading from Stdin
  for anu := range mes {
    if anu != "INPUT_END"{
      inputChunks = append(inputChunks, anu)
    } else {
      break
    }
  }
  jsonString = strings.Join(inputChunks, "")
  if err := json.Unmarshal([]byte(jsonString), &jsonMap); err != nil {
    throwError(err.Error())
  } else {
    processData(jsonMap)
  }
  fmt.Printf("processing time: %v", int32(time.Now().Unix()) - processingStart)
}

func processData(jsonMap map[string]interface{}) {
  var nestedFields = jsonMap["nestedFields"]
  var copyToSourceFields = jsonMap["copyToSourceFields"]
  var wrapperHits = jsonMap["hits"].(map[string]interface{})
  var hits = wrapperHits["hits"].([]interface{})
  var processedHits []interface{}
  var hitProcessingChannels []chan interface{}

  for i := 0; i < len(hits); i++ {
    var newChannel = make(chan interface{})
    hitProcessingChannels = append(hitProcessingChannels, newChannel)
    go processHit(hits[i], newChannel)
  }

  for i := 0; i < len(hits); i++ {
    fmt.Println(i)
    x := <-hitProcessingChannels[i]
    processedHits = append(processedHits, x)
  }

  fmt.Printf("nestedFields: %v\n", nestedFields)
  fmt.Printf("copyToSourceFields: %v\n", copyToSourceFields)
  fmt.Printf("len(hits): %v\n", len(hits))
  fmt.Printf("len(processedHits): %v\n", len(processedHits))
}

func processHit(
  hit interface{},
  channel chan interface{},
) {
  var nums []int
  for i := 1; i <= 10000000; i++ {
      nums = append(nums, i)
  }
  fmt.Printf("len(nums): %v\n", len(nums))
  channel <- nums
}

func hitToSource(hit interface{}) interface{} {
  var hitMap = hit.(map[string]interface{})
  return hitMap["_source"]
}

// Map an iterator to fn(el) for el in it
type Mapper func (interface{}) interface{}
type Iter chan interface{}
func Map(fn Mapper, it Iter) Iter {
	c := make(Iter)
	go func () {
		for el := range it {
			c <- fn(el)
		}
		close(c)
	}()
	return c
}

/* Function to run the groutine to run for stdin read */
func read(r io.Reader) <-chan string {
    lines := make(chan string)
    go func() {
        defer close(lines)
        scan := bufio.NewScanner(r)
        for scan.Scan() {
            lines <- scan.Text()
        }
    }()
    return lines
}

func returnResult(result string) {
  fmt.Printf(`{
    "type": "RESULT",
    "payload": %v
  }`, result)
}

func throwError(err string) {
  fmt.Printf(`{
    "type": "ERROR",
    "payload": %v
  }`, err)
}

func printSlice(s []string) {
	fmt.Printf("len=%d cap=%d %v\n", len(s), cap(s), s)
}
