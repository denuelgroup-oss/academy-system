<?php
// Root entry now points to the public_html structure.
if ($_SERVER['REQUEST_URI'] === '/' || $_SERVER['REQUEST_URI'] === '') {
    header('Location: /public_html/index.html');
    exit();
}

header('Location: /public_html/index.html');
exit();
?>
