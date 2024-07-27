var printingOrder = [];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};

function flipCanvas(canvas) {
    // Get the 2D context of the canvas
    const ctx = canvas.getContext('2d');
    
    // Create an off-screen canvas and get its context
    const offscreenCanvas = document.createElement('canvas');
    const offscreenCtx = offscreenCanvas.getContext('2d');
    
    // Set the off-screen canvas size to match the original canvas
    offscreenCanvas.width = canvas.width;
    offscreenCanvas.height = canvas.height;
    
    // Draw the current canvas content onto the off-screen canvas
    offscreenCtx.drawImage(canvas, 0, 0);
    
    // Clear the original canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Save the current state of the canvas
    ctx.save();
    
    // Translate to the bottom-left corner and flip the canvas
    ctx.translate(canvas.width, canvas.height);
    ctx.scale(-1, -1);
    
    // Draw the off-screen canvas content back onto the original canvas
    ctx.drawImage(offscreenCanvas, 0, 0);
    
    // Restore the original state of the canvas
    ctx.restore();
}

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('pdf-upload').addEventListener('change', function (event) {
        var file = event.target.files[0];
        if (file.type !== 'application/pdf') {
            alert('Please upload a PDF file.');
            return;
        }

        var reader = new FileReader();
        reader.onload = function (e) {
            if (typeof pdfjsLib === 'undefined') {
                console.error('pdfjsLib is not defined. Check if the pdf.js library is correctly loaded.');
                return;
            }

            // get printing otder
            var loadingTask = pdfjsLib.getDocument({ data: e.target.result });
            loadingTask.promise.then(async function (pdf) {
                var pdfDisplay = document.getElementById('pdf-display');
                pdfDisplay.innerHTML = ''; // Clear previous content

                // Get printing order
                printingOrder = [];
                const totalPages = pdf.numPages;
                const pagesInBooklet = Math.ceil(totalPages / 4) * 4;
                  
                // Loop through each sheet of paper
                for (let i = 0; i < pagesInBooklet / 4; i++) {
                    // Outermost pages first, moving inward
                    const leftOut = pagesInBooklet - (2 * i);
                    const rightOut = 2 * i + 1;
                    const leftIn = 2 * i + 2;
                    const rightIn = pagesInBooklet - (2 * i + 1);
                
                    // Add pages in the correct order for booklet printing
                    printingOrder.push(
                        rightOut > totalPages ? -1 : rightOut, 
                        leftOut > totalPages ? -1 : leftOut,  
                        leftIn > totalPages ? -1 : leftIn,    
                        rightIn > totalPages ? -1 : rightIn  
                    );
                }

                console.log(printingOrder);

                // Create images
                for (var pageNum = 1; pageNum <= totalPages; pageNum++) {
                    (async function(pageNum) {
                        await pdf.getPage(pageNum).then(async function (page) {
                            var viewport = page.getViewport({ scale: 1.5 });
                            var canvas = document.createElement('canvas');
                            var context = canvas.getContext('2d');
                            canvas.height = viewport.height;
                            canvas.width = viewport.width;

                            // Set the canvas id to correspond to the page number
                            canvas.id = 'page-' + pageNum;

                            var renderContext = {
                                canvasContext: context,
                                viewport: viewport
                            };
                            await page.render(renderContext).promise.then(async function () {
                                pdfDisplay.appendChild(canvas);
                            });
                        });
                    })(pageNum);
                }
            }, function (reason) {
                console.error('Error loading PDF: ', reason);
            });
        };
        reader.readAsArrayBuffer(file);
    });
});
  
async function createNewPDF(pageNumbers=[]) {
    if (printingOrder.length == 0) return;
    if (pageNumbers.length == 0) pageNumbers = printingOrder;
    // Apply a transformation for pages that need to be flipped
    for (var i = 0; i < printingOrder.length; i++) {
        if (printingOrder[i] != -1 && !(i % 4 >= 2)) {
            console.log(printingOrder[i]);
            var canvas = document.getElementById(`page-${printingOrder[i]}`);
            flipCanvas(canvas);
        }
    }

    await sleep(1000); // make it take longer to seem more legit

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('landscape'); // Create a new PDF in landscape mode
    const canvasWidth = 210; // A4 width in mm (jsPDF default)
    const canvasHeight = 297; // A4 height in mm (jsPDF default)

    pageNumbers.forEach((pageNum, index) => {
        const canvas = document.getElementById('page-' + pageNum);
        if (canvas) {
            const imgData = canvas.toDataURL('image/png');
            const positionX = (index % 2 === 0) ? 0 : canvasHeight / 2;
            const positionY = 0;

            // Add image to PDF
            pdf.addImage(imgData, 'PNG', positionX, positionY, canvasHeight/2, canvasWidth);
        }
        // Add a new page for every two images
        if (index % 2 !== 0 && index !== pageNumbers.length - 1) {
            pdf.addPage();
        }
    });

    pdf.save('output.pdf');
}

//createNewPDF();